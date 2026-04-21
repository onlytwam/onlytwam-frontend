import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/shared/api/axiosInstance';
import { getImageUrl } from '@/shared/utils/helpers';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface Brand {
  brandId:          number;
  brandName:        string;
  brandDescription: string | null;
  brandLogo:        string | null;
  brandImage:       string | null;
  isActive:         boolean;
}

interface ModalState {
  brandId?:     number;
  brandName:    string;
  description:  string;
  _logoFile:    File | null;
  _existingLogo: string | null;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const PAGE_SIZE = 20;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function resolveImgSrc(src: string | null | undefined): string {
  if (!src) return '';
  if (src.startsWith('http') || src.startsWith('/')) return src;
  return getImageUrl(`/${src}`);
}

function buildBrandFormData(modal: ModalState): FormData {
  const fd = new FormData();
  fd.append('brandName',        modal.brandName.trim());
  fd.append('brandDescription', modal.description.trim());
  fd.append('isActive',         'true');
  if (modal._logoFile) fd.append('brandLogo', modal._logoFile);
  return fd;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export default function AdminBrands() {
  const qc = useQueryClient();

  const [page,    setPage]    = useState(1);
  const [search,  setSearch]  = useState('');
  const [modal,   setModal]   = useState<ModalState | null>(null);
  const [confirm, setConfirm] = useState<Brand | null>(null);

  // ── Query ──────────────────────────────────

  const { data, isLoading } = useQuery({
    queryKey: ['admin-brands', page, search],
    queryFn: async () => {
      const filters = search.trim()
        ? JSON.stringify([{ property: 'QuickSearch', comparison: 'contains', value: search.trim() }])
        : undefined;

      const { data } = await api.get('/Brand/', {
        params: {
          ...(filters ? { Filters: filters } : {}),
          'Page.Index':      page,
          'Page.Size':       PAGE_SIZE,
          'Order.Property':  'Name',
          'Order.Ascending': true,
        },
      });
      return data as { list: Brand[]; count: number };
    },
  });

  const brands = data?.list  ?? [];
  const total  = data?.count ?? 0;
  const pages  = Math.ceil(total / PAGE_SIZE);

  // ── Mutations ──────────────────────────────

  const saveMutation = useMutation({
    mutationFn: (modal: ModalState) => {
      if (!modal.brandName.trim()) throw new Error('Brand name is required');
      const fd = buildBrandFormData(modal);
      return modal.brandId
        ? api.put(`/Brand/${modal.brandId}`, fd)
        : api.post('/Brand/', fd);
    },
    onSuccess: () => {
      toast.success('Brand saved!');
      qc.removeQueries({ queryKey: ['admin-brands'] });
      qc.invalidateQueries({ queryKey: ['admin-brands'] });
      setModal(null);
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail ?? e?.message ?? 'Save failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (brandId: number) => api.delete(`/Brand/${brandId}`),
    onSuccess: () => {
      toast.success('Brand deleted');
      qc.removeQueries({ queryKey: ['admin-brands'] });
      qc.invalidateQueries({ queryKey: ['admin-brands'] });
      setConfirm(null);
    },
    onError: () => toast.error('Delete failed — brand may be in use'),
  });

  // ── Modal helpers ──────────────────────────

  const openAdd = () =>
    setModal({ brandName: '', description: '', _logoFile: null, _existingLogo: null });

  const openEdit = (b: Brand) =>
    setModal({
      brandId:      b.brandId,
      brandName:    b.brandName,
      description:  b.brandDescription ?? '',
      _logoFile:    null,
      _existingLogo: b.brandLogo ?? b.brandImage ?? null,
    });

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  return (
    <div>

      {/* ── Header ── */}
      <div className="s-adminblog-fe4afb">
        <div>
          <h2 className="s-adminblog-91c675">Brands</h2>
          <p className="s-adminblog-1c2c10">{total} total</p>
        </div>
        <div className="s-adminbrands-bccf37">
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search brands…"
            className="inp-field s-adminbrands-b9d1c5"
          />
          <button onClick={openAdd} className="s-adminbrands-d3409f">
            + Add Brand
          </button>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="s-adminbrands-a637bc">
        <table className="s-adminbrands-de3642">
          <thead>
            <tr className="s-adminbrands-1ba202">
              {['Logo', 'Name', 'Description','Actions'].map(h => (
                <th key={h} className="s-adminbrands-84e069">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} className="s-adminbrands-3e0634">Loading…</td></tr>
            ) : brands.length === 0 ? (
              <tr><td colSpan={4} className="s-adminbrands-3e0634">No brands found.</td></tr>
            ) : brands.map(b => {
              const logoSrc = resolveImgSrc(b.brandLogo ?? b.brandImage);
              return (
                <tr key={b.brandId} className="s-adminbrands-59d787">

                  {/* Logo */}
                  <td className="s-adminbrands-7dcd2c">
                    {logoSrc ? (
                      <img
                        src={logoSrc}
                        alt={b.brandName}
                        className="s-adminbrands-0c5599"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div className="s-adminbrands-6167ec">
                        <i className="bi bi-image s-adminbrands-95b451" />
                      </div>
                    )}
                  </td>

                  <td className="s-adminbrands-c25a6e">{b.brandName}</td>
                  <td className="s-adminbrands-6d0b42">{b.brandDescription ?? '—'}</td>

              

                  {/* Actions */}
                  <td className="s-adminbrands-7dcd2c">
                    <div className="s-adminbrands-ac734d">
                      <button onClick={() => openEdit(b)}      className="s-adminbrands-6ea383">Edit</button>
                      <button onClick={() => setConfirm(b)}    className="s-adminbrands-6ea383">Delete</button>
                    </div>
                  </td>

                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {pages > 1 && (
        <div className="s-adminblog-213a15">
          {Array.from({ length: Math.min(pages, 10) }, (_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              className="s-adminbrands-93c0a2"
              style={{
                borderColor: page === i + 1 ? 'var(--brand)' : 'var(--ivory)',
                background:  page === i + 1 ? 'var(--brand)' : '#fff',
                color:       page === i + 1 ? '#fff'         : '#000',
              }}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      {modal && (
        <div className="s-adminbrands-942dbe">
          <div className="s-adminbrands-cd5358">
            <h3 className="s-adminblog-e6371f">
              {modal.brandId ? 'Edit' : 'New'} Brand
            </h3>

            {([
              ['Brand Name *', 'brandName',   'text'],
              ['Description',  'description', 'text'],
            ] as const).map(([label, key, type]) => (
              <div key={key} className="s-adminblog-22a617">
                <label className="s-addressform-f1fb64">{label}</label>
                <input
                  type={type}
                  value={modal[key] ?? ''}
                  onChange={e => setModal(prev => prev ? { ...prev, [key]: e.target.value } : prev)}
                  className="inp-field"
                />
              </div>
            ))}

            {/* Logo upload */}
            <div className="s-adminblog-22a617">
              <label className="s-addressform-f1fb64">Logo</label>
              {modal._existingLogo && !modal._logoFile && (
                <img
                  src={resolveImgSrc(modal._existingLogo)}
                  alt="current logo"
                  style={{ height: 40, marginBottom: 6, display: 'block', objectFit: 'contain' }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              {modal._logoFile && (
                <img
                  src={URL.createObjectURL(modal._logoFile)}
                  alt="new logo preview"
                  style={{ height: 40, marginBottom: 6, display: 'block', objectFit: 'contain' }}
                />
              )}
              <input
                type="file"
                accept="image/*"
                className="inp-field"
                onChange={e => {
                  const file = e.target.files?.[0] ?? null;
                  setModal(prev => prev ? { ...prev, _logoFile: file } : prev);
                }}
              />
            </div>

            <div className="s-adminbrands-fcea5e">
              <button
                onClick={() => setModal(null)}
                className="s-adminbrands-5a7ba1"
                disabled={saveMutation.isPending}
              >
                Cancel
              </button>
              <button
                onClick={() => modal && saveMutation.mutate(modal)}
                disabled={!modal.brandName.trim() || saveMutation.isPending}
                className="s-adminbrands-d3409f"
                style={{ opacity: !modal.brandName.trim() ? 0.5 : 1 }}
              >
                {saveMutation.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {confirm && (
        <div className="s-adminbrands-942dbe">
          <div className="s-adminblog-69ab70">
            <h3 className="s-adminblog-caf79d">Delete "{confirm.brandName}"?</h3>
            <p className="s-adminbrands-93cf07">
              This cannot be undone. Products linked to this brand may be affected.
            </p>
            <div className="s-adminblog-679e96">
              <button
                onClick={() => setConfirm(null)}
                disabled={deleteMutation.isPending}
                className="s-adminbrands-c554f0"
              >
                Cancel
              </button>
              <button
                onClick={() => confirm && deleteMutation.mutate(confirm.brandId)}
                disabled={deleteMutation.isPending}
                className="s-adminbrands-ad5bf3"
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}