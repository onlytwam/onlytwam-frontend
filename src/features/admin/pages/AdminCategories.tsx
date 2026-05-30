import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axiosInstance";
import toast from "react-hot-toast";
import { useMenuStore } from "@/shared/store/menuStore";
import { getImageUrl } from "@/shared/utils/helpers";

const BRAND = "#6B0F2A";

// ── Category image upload hook ───────────────────────────────────────────────
function useCategoryImageUpload(
  categoryId: number | undefined,
  onSuccess: (imageUrl: string) => void,
) {
  return useMutation({
    mutationFn: async (file: File) => {
      if (!categoryId)
        throw new Error("Save the category first before uploading an image.");
      const form = new FormData();
      form.append("file", file);
      const res = await api.put(`/Category/${categoryId}/image`, form);
      return res.data;
    },
    onSuccess: (res: any) => {
      toast.success("Category image updated.");
      onSuccess(res?.imageUrl ?? "");
    },
    onError: (e: any) =>
      toast.error(
        e?.response?.data?.detail || e?.message || "Image upload failed.",
      ),
  });
}

// ── ImageUploadField ─────────────────────────────────────────────────────────
function ImageUploadField({
  categoryId,
  currentUrl,
  onUploaded,
}: {
  categoryId?: number;
  currentUrl?: string;
  onUploaded: (url: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string>("");
  const qc = useQueryClient();

  const upload = useCategoryImageUpload(categoryId, (imageUrl: string) => {
    qc.invalidateQueries({ queryKey: ["admin-categories-tree"] });
    if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    setPreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    onUploaded(imageUrl);
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    const blobUrl = URL.createObjectURL(file);
    setPreview(blobUrl);
  };

  const handleSave = () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Select a file first.");
      return;
    }
    if (!categoryId) {
      toast.error("Save the category first, then upload its image.");
      return;
    }
    upload.mutate(file);
  };

  const displayUrl = preview || currentUrl;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          width: "100%",
          height: 120,
          borderRadius: 10,
          border: "1.5px dashed #d9cac2",
          background: displayUrl
            ? `url("${displayUrl}") center/cover no-repeat #f5f0eb`
            : "#f5f0eb",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {!displayUrl && (
          <span style={{ fontSize: 12, color: "#b89fa8" }}>No image</span>
        )}
        {preview && (
          <span
            style={{
              position: "absolute",
              top: 6,
              right: 6,
              background: BRAND,
              color: "#fff",
              fontSize: 9,
              fontWeight: 700,
              padding: "2px 7px",
              borderRadius: 20,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Preview
          </span>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        style={{
          fontSize: 12,
          border: "1px solid #d9cac2",
          borderRadius: 8,
          padding: "6px 10px",
          background: "#faf8f6",
          cursor: "pointer",
        }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={handleSave}
          disabled={upload.isPending || !preview}
          style={{
            flex: 1,
            background: upload.isPending || !preview ? "#d4b8be" : BRAND,
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "8px 0",
            fontSize: 12,
            fontWeight: 700,
            cursor: upload.isPending || !preview ? "not-allowed" : "pointer",
          }}
        >
          {upload.isPending ? "Uploading…" : "Upload Image"}
        </button>
        {preview && (
          <button
            onClick={() => {
              setPreview("");
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
            style={{
              background: "#f5f0eb",
              color: BRAND,
              border: "1px solid #d9cac2",
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        )}
      </div>
      {!categoryId && (
        <p style={{ margin: 0, fontSize: 11, color: "#aaa" }}>
          Save the category first, then you can upload its image.
        </p>
      )}
    </div>
  );
}

// ── Image Viewer Modal ───────────────────────────────────────────────────────
function ImageViewerModal({
  url,
  name,
  onClose,
  onDelete,
}: {
  url: string;
  name: string;
  onClose: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 3000,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 14,
          padding: 24,
          maxWidth: "90vw",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          boxShadow: "0 8px 40px rgba(0,0,0,0.3)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 15, color: "#333" }}>
            {name}
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 20,
              cursor: "pointer",
              color: "#888",
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
        <img
          src={url}
          alt={name}
          style={{
            maxWidth: "80vw",
            maxHeight: "70vh",
            objectFit: "contain",
            borderRadius: 8,
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
          }}
        >
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 12, color: BRAND, textDecoration: "underline" }}
          >
            Open full image ↗
          </a>
          {onDelete && (
            <button
              onClick={onDelete}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 12px",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 7,
                border: "1px solid #f5c6cb",
                background: "#fdecea",
                color: "#c62828",
                cursor: "pointer",
              }}
            >
              🗑 Delete Image
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── View-only Category Modal ─────────────────────────────────────────────────
function ViewCategoryModal({
  cat,
  onClose,
  onEdit,
  onViewImage,
}: {
  cat: any;
  onClose: () => void;
  onEdit: () => void;
  onViewImage: (url: string, name: string, categoryId: number) => void;
}) {
  const row = (label: string, value: React.ReactNode) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        padding: "10px 0",
        borderBottom: "1px solid #f0e8e3",
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "#999",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 14, color: "#333", wordBreak: "break-word" }}>
        {value || "—"}
      </span>
    </div>
  );

  return (
    <div className="s-admincategor-172a23">
      <div
        className="s-adminbrands-cd5358"
        style={{ maxWidth: 460, width: "100%" }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 12,
          }}
        >
          <h3 className="s-adminblog-e6371f" style={{ margin: 0 }}>
            Category Details
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 20,
              cursor: "pointer",
              color: "#888",
              lineHeight: 1,
              padding: 0,
            }}
          >
            ✕
          </button>
        </div>
        {cat.categoryImage && (
          <div
            style={{
              width: "100%",
              height: 140,
              borderRadius: 10,
              overflow: "hidden",
              marginBottom: 12,
              cursor: "pointer",
              border: "1px solid #eadfd8",
            }}
            onClick={() =>
              onViewImage(
                getImageUrl(cat.categoryImage, ""),
                cat.name,
                cat.categoryId,
              )
            }
            title="Click to view full image"
          >
            <img
              src={getImageUrl(cat.categoryImage)}
              alt={cat.name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {row("ID", `#${cat.categoryId}`)}
          {row("Name", cat.name)}
          {row("Description", cat.description)}
          {row(
            "Parent",
            cat.parentCategoryName
              ? `${cat.parentCategoryName} (#${cat.parentCategoryId})`
              : cat.parentCategoryId
              ? `#${cat.parentCategoryId}`
              : "Root (No Parent)",
          )}
          {row(
            "Status",
            <span
              style={{
                display: "inline-block",
                padding: "3px 10px",
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 700,
                background: cat.isActive !== false ? "#e6f4ea" : "#fdecea",
                color: cat.isActive !== false ? "#2e7d32" : "#c62828",
              }}
            >
              {cat.isActive !== false ? "Active" : "Inactive"}
            </span>,
          )}
        </div>
        <div className="s-adminblog-679e96" style={{ marginTop: 16 }}>
          <button onClick={onClose} className="s-admincategor-68998a">
            Close
          </button>
          <button onClick={onEdit} className="s-admincategor-153727">
            ✏️ Edit
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Types ────────────────────────────────────────────────────────────────────
type CatItem = {
  categoryId: number;
  name: string;
  displayOrder: number;
  isActive: boolean;
  description?: string;
  categoryImage?: string;
  parentCategoryId?: number | null;
  parentCategoryName?: string;
  deletedInd?: boolean;
};

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminCategories() {
  const qc = useQueryClient();
  const { setMenus } = useMenuStore();

  // ── Modal / confirm state ──────────────────────────────────────────────────
  const [viewModal, setViewModal] = useState<any>(null);
  const [modal, setModal] = useState<any>(null);
  const [confirm, setConfirm] = useState<any>(null);
  const [confirmDeleteImage, setConfirmDeleteImage] = useState<any>(null);
  const [viewImage, setViewImage] = useState<{
    url: string;
    name: string;
    categoryId?: number;
  } | null>(null);
  // ── Unhide flow: two-step (children first → then products) ─────────────────
  const [unhideChildrenConfirm, setUnhideChildrenConfirm] = useState<{
    cat: any;
    childCount: number;
  } | null>(null);
  // Step 2 of unhide flow: ask whether to also restore products
  const [unhideProductsConfirm, setUnhideProductsConfirm] = useState<{
    cat: any;
    unhideChildren: boolean;
  } | null>(null);

  // ── Tree / reorder state ───────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [expandedParents, setExpandedParents] = useState<Set<number>>(
    new Set(),
  );
  const [rootOrder, setRootOrder] = useState<CatItem[]>([]);
  const [childOrder, setChildOrder] = useState<Record<number, CatItem[]>>({});
  const [dirty, setDirty] = useState(false);
  const dragItem = useRef<{ list: "root" | number; index: number } | null>(
    null,
  );

  // ── Fetch all categories (tree needs full list, ordered by displayOrder) ───
  const INV = ["admin-categories-tree"] as const;

  const { data, isLoading } = useQuery({
    queryKey: INV,
    queryFn: () =>
      api
        .get("/Category", {
          params: {
            "Page.Size": 500,
            "Order.Property": "DisplayOrder",
            "Order.Ascending": true,
          },
        })
        .then((r) => r.data),
    staleTime: 0,
  });

  const allCats: CatItem[] = data?.list ?? [];
  const total = data?.count ?? 0;

  // ── Product count per category ───────────────────────────────────────────
  const { data: productCountData } = useQuery({
    queryKey: ["category-product-counts"],
    queryFn: () =>
      api
        .get("/Category/GetCategoryProductCount")
        .then((r) => r.data as { categoryId: number; count: number }[]),
    staleTime: 30_000,
  });

  const productCountMap = useMemo<Record<number, number>>(() => {
    if (!productCountData) return {};
    return Object.fromEntries(
      productCountData.map((r: any) => [r.categoryId, r.count]),
    );
  }, [productCountData]);

  // For a parent category, total = products directly on the parent (no child
  // assigned) + products in every child category.  The backend SQL now filters
  // ChildCategoryId IS NULL on the parent-direct branch, so there is no
  // overlap between the two buckets even in the mixed case (parent has both
  // child categories AND some products filed straight on it).
  const getCategoryProductCount = useCallback(
    (catId: number): number => {
      const direct = productCountMap[catId] ?? 0;
      const children = allCats.filter((c) => c.parentCategoryId === catId);
      return (
        direct +
        children.reduce(
          (sum, ch) => sum + (productCountMap[ch.categoryId] ?? 0),
          0,
        )
      );
    },
    [productCountMap, allCats],
  );

  // ── Build tree ────────────────────────────────────────────────────────────
  const roots = useMemo(
    () =>
      allCats
        .filter((c) => !c.parentCategoryId)
        .sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999)),
    [allCats],
  );

  const childrenOf = useCallback(
    (parentId: number) =>
      allCats
        .filter((c) => c.parentCategoryId === parentId)
        .sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999)),
    [allCats],
  );

  // Signature used to detect when server data has meaningfully changed
  const allCatsSig = allCats
    .map((c) => `${c.categoryId}:${c.displayOrder}:${c.isActive}`)
    .join(",");

  // Re-seed local drag state only when NOT mid-edit (dirty=false)
  useEffect(() => {
    if (!roots.length || dirty) return;
    setRootOrder(roots.slice());
    const kids: Record<number, CatItem[]> = {};
    roots.forEach((r) => {
      const ch = childrenOf(r.categoryId);
      if (ch.length) kids[r.categoryId] = ch.slice();
    });
    setChildOrder(kids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCatsSig]);

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const handleDragStart = (list: "root" | number, index: number) => {
    dragItem.current = { list, index };
  };

  const handleDragEnter = (list: "root" | number, index: number) => {
    if (!dragItem.current) return;
    if (dragItem.current.list !== list) return; // cross-list not allowed
    const from = dragItem.current.index;
    if (from === index) return;

    if (list === "root") {
      setRootOrder((prev) => {
        const next = [...prev];
        const [moved] = next.splice(from, 1);
        next.splice(index, 0, moved);
        dragItem.current!.index = index;
        return next;
      });
    } else {
      setChildOrder((prev) => {
        const kids = [...(prev[list as number] ?? [])];
        const [moved] = kids.splice(from, 1);
        kids.splice(index, 0, moved);
        dragItem.current!.index = index;
        return { ...prev, [list as number]: kids };
      });
    }
    setDirty(true);
  };

  const handleDragEnd = () => {
    dragItem.current = null;
  };

  // ── Save order ────────────────────────────────────────────────────────────
  const saveOrderMut = useMutation({
    mutationFn: (payload: { categoryId: number; displayOrder: number }[]) =>
      api.patch("/Category/reorder", payload),
    onSuccess: () => {
      toast.success("Order saved!");
      qc.invalidateQueries({ queryKey: INV });
      window.dispatchEvent(new CustomEvent("categoriesUpdated"));
      if (typeof BroadcastChannel !== "undefined") {
        const ch = new BroadcastChannel("category_visibility");
        ch.postMessage({ type: "CATEGORIES_UPDATED" });
        ch.close();
      }
      setDirty(false);
    },
    onError: () => toast.error("Failed to save order."),
  });

  const handleSaveOrder = () => {
    const payload: { categoryId: number; displayOrder: number }[] = [];
    rootOrder.forEach((r, i) =>
      payload.push({ categoryId: r.categoryId, displayOrder: i + 1 }),
    );
    Object.entries(childOrder).forEach(([, kids]) => {
      (kids as CatItem[]).forEach((k, i) =>
        payload.push({ categoryId: k.categoryId, displayOrder: i + 1 }),
      );
    });
    saveOrderMut.mutate(payload);
  };

  // ── CRUD mutations ────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (form: any) => {
      const { bandSizeType: _b, hasCupSize: _h, ...payload } = form;
      return form.categoryId
        ? api.put(`/Category/${form.categoryId}`, payload)
        : api.post("/Category", payload);
    },
    onSuccess: (res, form) => {
      toast.success("Saved!");
      qc.invalidateQueries({ queryKey: INV });
      if (form.categoryId) {
        setModal(null);
      } else {
        setModal((prev: any) => ({
          ...prev,
          categoryId: res?.data?.categoryId,
        }));
      }
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail || "Save failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/Category/${id}`),
    onSuccess: (res: any) => {
      const deleted = res?.data?.childrenDeleted ?? 0;
      toast.success(
        deleted > 0
          ? `Category deleted. ${deleted} child categor${
              deleted === 1 ? "y" : "ies"
            } also deleted. All affected products are now inactive.`
          : "Category deleted. All its products are now inactive.",
      );
      qc.invalidateQueries({ queryKey: INV });
      setConfirm(null);
    },
    onError: () => toast.error("Delete failed"),
  });

  const doToggleVisibility = useMutation({
    mutationFn: ({
      id,
      unhideChildren,
      cascadeProducts,
    }: // catName is UI-only; not sent to API
    {
      id: number;
      catName?: string;
      unhideChildren?: boolean;
      cascadeProducts?: boolean;
    }) => {
      const params: Record<string, any> = {};
      if (unhideChildren) params.unhideChildren = true;
      if (cascadeProducts) params.cascadeProducts = true;
      return api.patch(`/Category/${id}/visibility`, null, {
        params: Object.keys(params).length ? params : undefined,
      });
    },

    onMutate: async ({ id, unhideChildren }) => {
      await qc.cancelQueries({ queryKey: INV });
      const previousData = qc.getQueriesData({ queryKey: INV });

      qc.setQueriesData({ queryKey: INV }, (old: any) => {
        if (!old?.list) return old;
        const newList = old.list.map((cat: any) => {
          if (cat.categoryId === id) {
            return { ...cat, isActive: !cat.isActive };
          }
          const parentBeingHidden = old.list.find(
            (c: any) => c.categoryId === id && c.isActive !== false,
          );
          if (parentBeingHidden && cat.parentCategoryId === id) {
            return { ...cat, isActive: false };
          }
          if (unhideChildren && cat.parentCategoryId === id) {
            return { ...cat, isActive: true };
          }
          return cat;
        });
        return { ...old, list: newList };
      });
      return { previousData };
    },

    onSuccess: (res: any, { catName, id }) => {
      const newIsActive = res?.data?.isActive;
      const displayName = catName ?? "Category";
      // Toast only when unhiding — hiding is intentionally silent
      if (newIsActive) {
        toast.success(`"${displayName}" is now visible.`);
      }
      qc.invalidateQueries({ queryKey: INV });
      qc.invalidateQueries({
        predicate: (q) => {
          const key = String(q.queryKey[0] ?? "");
          return key.includes("categor") || key === "gs-categories";
        },
      });
      qc.invalidateQueries({ queryKey: ["all-products-page"] });
      qc.invalidateQueries({ queryKey: ["products-list"] });
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      sessionStorage.removeItem("menus");
      setMenus([]);
      window.dispatchEvent(new CustomEvent("categoriesUpdated"));
      if (typeof BroadcastChannel !== "undefined") {
        const ch = new BroadcastChannel("category_visibility");
        ch.postMessage({ type: "CATEGORIES_UPDATED" });
        ch.close();
      }
      setUnhideChildrenConfirm(null);
      setUnhideProductsConfirm(null);
    },

    onError: (_err: any, _vars: any, context: any) => {
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, oldData]: [any, any]) => {
          qc.setQueryData(queryKey, oldData);
        });
      }
      toast.error("Could not update visibility.");
    },
  });

  const deleteImageMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/Category/${id}/image`),
    onSuccess: () => {
      toast.success("Category image removed.");
      qc.invalidateQueries({ queryKey: INV });
      setConfirmDeleteImage(null);
      setViewImage(null);
    },
    onError: () => toast.error("Could not delete image."),
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getChildCount = (categoryId: number) =>
    (childOrder[categoryId] ?? childrenOf(categoryId)).length;

  const handleToggleVisibility = (c: any) => {
    const childCount = getChildCount(c.categoryId);
    const isCurrentlyVisible = c.isActive !== false;

    if (isCurrentlyVisible) {
      // ── HIDING ─────────────────────────────────────────────────────────
      // Always auto-cascade products. No confirmation needed.
      // For parent categories: show an info toast so admin knows children are also hidden.
      if (childCount > 0) {
        toast(
          `"${c.name}" hidden — ${childCount} child ${
            childCount === 1 ? "category" : "categories"
          } and all their products are also hidden.`,
          { icon: "🙈" },
        );
      }
      doToggleVisibility.mutate({
        id: c.categoryId,
        catName: c.name,
        cascadeProducts: true,
      });
    } else {
      // ── UNHIDING ───────────────────────────────────────────────────────
      // Collect all choices first (children? products?), then fire ONE API call.
      if (childCount > 0) {
        // Parent: step 1 → ask about children
        setUnhideChildrenConfirm({ cat: c, childCount });
      } else {
        // Child (leaf) category: skip children step, go straight to products
        setUnhideProductsConfirm({ cat: c, unhideChildren: false });
      }
    }
  };

  const openNew = () =>
    setModal({
      name: "",
      description: "",
      parentCategoryId: null,
      categoryImage: "",
    });

  // ── Search filter (flat) ──────────────────────────────────────────────────
  const searchLower = search.trim().toLowerCase();
  const isSearching = !!searchLower;
  const filteredFlat = isSearching
    ? allCats.filter(
        (c) =>
          c.name?.toLowerCase().includes(searchLower) ||
          (c.description as any)?.toLowerCase().includes(searchLower),
      )
    : [];

  // ── Shared render helpers ─────────────────────────────────────────────────
  const renderThumb = (c: any) =>
    c.categoryImage ? (
      <div style={{ position: "relative", width: 42, flexShrink: 0 }}>
        <img
          src={getImageUrl(c.categoryImage)}
          alt={c.name}
          onClick={() =>
            setViewImage({
              url: getImageUrl(c.categoryImage, ""),
              name: c.name,
              categoryId: c.categoryId,
            })
          }
          onError={(e) =>
            ((e.target as HTMLImageElement).style.display = "none")
          }
          style={{
            width: 42,
            height: 42,
            objectFit: "cover",
            borderRadius: 7,
            border: "1px solid #eadfd8",
            display: "block",
            cursor: "pointer",
          }}
          title="Click to view"
        />
        <button
          onClick={() => setConfirmDeleteImage(c)}
          title="Remove image"
          style={{
            position: "absolute",
            top: -5,
            right: -5,
            width: 16,
            height: 16,
            background: BRAND,
            color: "#fff",
            border: "none",
            borderRadius: "50%",
            fontSize: 9,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
          }}
        >
          ×
        </button>
      </div>
    ) : (
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 7,
          background: "#f5f0eb",
          border: "1px dashed #d9cac2",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 8, color: "#b89fa8" }}>None</span>
      </div>
    );

  const renderActions = (c: any) => (
    <div style={{ display: "flex", gap: 4, flexWrap: "nowrap" }}>
      <button
        onClick={() => setViewModal(c)}
        style={{
          padding: "4px 9px",
          fontSize: 11,
          fontWeight: 600,
          borderRadius: 6,
          border: "1px solid #9fa8da",
          background: "#e8eaf6",
          color: "#3949ab",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        👁 View
      </button>
      <button
        onClick={() => setModal(c)}
        style={{
          padding: "4px 9px",
          fontSize: 11,
          fontWeight: 600,
          borderRadius: 6,
          border: "1px solid #d9cac2",
          background: "#f5f0eb",
          color: BRAND,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        ✏️ Edit
      </button>
      <button
        onClick={() => handleToggleVisibility(c)}
        disabled={doToggleVisibility.isPending}
        style={{
          padding: "4px 9px",
          fontSize: 11,
          fontWeight: 600,
          borderRadius: 6,
          border: "1px solid",
          cursor: doToggleVisibility.isPending ? "not-allowed" : "pointer",
          opacity:
            doToggleVisibility.isPending &&
            doToggleVisibility.variables?.id === c.categoryId
              ? 0.6
              : 1,
          background: c.isActive !== false ? "#fff8e1" : "#e8f5e9",
          borderColor: c.isActive !== false ? "#f9a825" : "#43a047",
          color: c.isActive !== false ? "#e65100" : "#2e7d32",
          whiteSpace: "nowrap",
        }}
      >
        {doToggleVisibility.isPending &&
        doToggleVisibility.variables?.id === c.categoryId
          ? "…"
          : c.isActive !== false
          ? "🙈 Hide"
          : "👁 Show"}
      </button>
      <button
        onClick={() => setConfirm(c)}
        style={{
          padding: "4px 9px",
          fontSize: 11,
          fontWeight: 600,
          borderRadius: 6,
          border: "1px solid #f5c6cb",
          background: "#fdecea",
          color: "#c62828",
          cursor: "pointer",
        }}
      >
        🗑
      </button>
    </div>
  );

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ─── Header ─── */}
      <div className="s-adminblog-fe4afb">
        <div>
          <h2 className="s-adminblog-91c675">Categories</h2>
          <p className="s-adminblog-1c2c10">{total} total</p>
        </div>
        <div className="s-adminbrands-bccf37" style={{ gap: 8 }}>
          {/* Save Order — only visible when there are unsaved drag changes */}
          {dirty && (
            <button
              onClick={handleSaveOrder}
              disabled={saveOrderMut.isPending}
              style={{
                padding: "8px 18px",
                fontSize: 13,
                fontWeight: 700,
                borderRadius: 7,
                border: "none",
                background: saveOrderMut.isPending ? "#c4788c" : BRAND,
                color: "#fff",
                cursor: saveOrderMut.isPending ? "not-allowed" : "pointer",
                boxShadow: "0 0 0 3px rgba(107,15,42,0.18)",
                animation: "pulse 1.8s ease-in-out infinite",
              }}
            >
              {saveOrderMut.isPending ? "Saving…" : "💾 Save Order"}
            </button>
          )}
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
            placeholder="Search…"
            className="inp-field s-admincategor-7a6c83"
          />
          <button onClick={openNew} className="s-admincategor-153727">
            + Add Category
          </button>
        </div>
      </div>

      {/* ─── Content area ─── */}
      {isLoading ? (
        <div
          style={{
            padding: 48,
            textAlign: "center",
            color: "#bbb",
            fontSize: 14,
          }}
        >
          Loading categories…
        </div>
      ) : isSearching ? (
        /* ── SEARCH: flat filtered table ─────────────────────────────── */
        <div className="s-adminbrands-a637bc">
          <table className="s-adminbrands-de3642">
            <thead>
              <tr className="s-adminbrands-1ba202">
                {[
                  "ID",
                  "Image",
                  "Name",
                  "Description",
                  "Parent",
                  "Status",
                  "Actions",
                ].map((h) => (
                  <th key={h} className="s-adminbrands-84e069">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredFlat.length === 0 ? (
                <tr>
                  <td colSpan={7} className="s-adminbrands-3e0634">
                    No categories match "{search}".
                  </td>
                </tr>
              ) : (
                filteredFlat.map((c) => (
                  <tr
                    key={c.categoryId}
                    className="s-adminbrands-59d787"
                    style={{
                      background: c.isActive === false ? "#fffbf0" : undefined,
                    }}
                  >
                    <td className="s-admincategor-ec7211">{c.categoryId}</td>
                    <td className="s-admincategor-ec7211">{renderThumb(c)}</td>
                    <td className="s-admincategor-46dbfc">
                      {c.name}
                      {c.isActive === false && (
                        <span
                          style={{
                            marginLeft: 6,
                            fontSize: 10,
                            background: "#fdecea",
                            color: "#c62828",
                            padding: "2px 6px",
                            borderRadius: 10,
                            fontWeight: 700,
                            textTransform: "uppercase",
                          }}
                        >
                          Inactive
                        </span>
                      )}
                      {getChildCount(c.categoryId) > 0 && (
                        <span
                          style={{
                            marginLeft: 6,
                            fontSize: 10,
                            background: "#e3f2fd",
                            color: "#1565c0",
                            padding: "2px 6px",
                            borderRadius: 10,
                            fontWeight: 600,
                          }}
                        >
                          parent
                        </span>
                      )}
                      {(() => {
                        const count = getCategoryProductCount(c.categoryId);
                        return (
                          <span
                            title={`${count} product${
                              count !== 1 ? "s" : ""
                            } in this category`}
                            style={{
                              marginLeft: 6,
                              fontSize: 10,
                              background: count > 0 ? "#f3e5f5" : "#f5f5f5",
                              color: count > 0 ? "#6a1b9a" : "#9e9e9e",
                              padding: "2px 7px",
                              borderRadius: 10,
                              fontWeight: 700,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {count} {count === 1 ? "product" : "products"}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="s-admincategor-ec7211">
                      {c.description || "—"}
                    </td>
                    <td className="s-admincategor-ec7211">
                      {(c as any).parentCategoryName
                        ? `${(c as any).parentCategoryName} (#${
                            c.parentCategoryId
                          })`
                        : c.parentCategoryId
                        ? `#${c.parentCategoryId}`
                        : "Root"}
                    </td>
                    <td className="s-admincategor-ec7211">
                      <span
                        style={{
                          display: "inline-block",
                          padding: "3px 10px",
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 700,
                          background:
                            c.isActive !== false ? "#e6f4ea" : "#fdecea",
                          color: c.isActive !== false ? "#2e7d32" : "#c62828",
                        }}
                      >
                        {c.isActive !== false ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="s-admincategor-19b711">
                      {renderActions(c)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* ── TREE VIEW: drag-and-drop reorder + expand/collapse ──────── */
        <div style={{ padding: "4px 0 32px" }}>
          {/* Hint bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 12,
              padding: "8px 14px",
              background: "#faf8f6",
              border: "1px solid #ece6f0",
              borderRadius: 8,
              fontSize: 12,
              color: "#888",
            }}
          >
            <span style={{ color: "#ccc", fontSize: 16 }}>⠿</span>
            <span>Drag any row to reorder.</span>
            <span>▶ to expand subcategories and reorder them too.</span>
            {dirty && (
              <span
                style={{
                  marginLeft: "auto",
                  fontWeight: 700,
                  color: BRAND,
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                ● Unsaved changes — click <strong>💾 Save Order</strong> to
                apply
              </span>
            )}
          </div>

          {rootOrder.length === 0 ? (
            <p style={{ textAlign: "center", color: "#bbb", padding: 48 }}>
              No categories found.
            </p>
          ) : (
            rootOrder.map((root, ri) => {
              const kids = childOrder[root.categoryId] ?? [];
              const expanded = expandedParents.has(root.categoryId);

              return (
                <div key={root.categoryId} style={{ marginBottom: 3 }}>
                  {/* ── Parent row ─────────────────────────────────────── */}
                  <div
                    draggable
                    onDragStart={() => handleDragStart("root", ri)}
                    onDragEnter={() => handleDragEnter("root", ri)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => e.preventDefault()}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 14px",
                      background: root.isActive !== false ? "#fff" : "#fffbf0",
                      border: `1.5px solid ${
                        root.isActive !== false ? "#e0d5f0" : "#f5c6cb"
                      }`,
                      borderLeft: `4px solid ${BRAND}`,
                      borderRadius: 9,
                      cursor: "grab",
                      userSelect: "none",
                      boxShadow: "0 1px 5px rgba(0,0,0,0.06)",
                      transition: "box-shadow 0.12s",
                    }}
                  >
                    {/* Drag handle */}
                    <span
                      style={{
                        color: "#c8b8c4",
                        fontSize: 18,
                        flexShrink: 0,
                        lineHeight: 1,
                      }}
                    >
                      ⠿
                    </span>

                    {/* Position badge */}
                    <span
                      style={{
                        minWidth: 24,
                        height: 24,
                        borderRadius: 6,
                        background: BRAND,
                        color: "#fff",
                        fontSize: 11,
                        fontWeight: 800,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        letterSpacing: "-0.02em",
                      }}
                    >
                      {ri + 1}
                    </span>

                    {/* Expand / collapse children */}
                    {kids.length > 0 ? (
                      <button
                        onClick={() =>
                          setExpandedParents((prev) => {
                            const next = new Set(prev);
                            next.has(root.categoryId)
                              ? next.delete(root.categoryId)
                              : next.add(root.categoryId);
                            return next;
                          })
                        }
                        style={{
                          background: expanded ? "#f0e8f8" : "#f5f0fb",
                          border: `1px solid ${
                            expanded ? "#c9a8d8" : "#d8cce8"
                          }`,
                          borderRadius: 6,
                          padding: "3px 10px",
                          fontSize: 11,
                          cursor: "pointer",
                          color: BRAND,
                          fontWeight: 700,
                          flexShrink: 0,
                          whiteSpace: "nowrap",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <span
                          style={{
                            display: "inline-block",
                            transform: expanded
                              ? "rotate(90deg)"
                              : "rotate(0deg)",
                            transition: "transform 0.15s",
                            fontSize: 10,
                          }}
                        >
                          ▶
                        </span>
                        {kids.length} {kids.length === 1 ? "sub" : "subs"}
                      </button>
                    ) : (
                      /* spacer so rows without children still align */
                      <span style={{ width: 62, flexShrink: 0 }} />
                    )}

                    {/* Thumbnail */}
                    {renderThumb(root as any)}

                    {/* Name + description */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          flexWrap: "wrap",
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: 14,
                            color: "#1a1a1a",
                          }}
                        >
                          {root.name}
                        </span>
                        {root.isActive === false && (
                          <span
                            style={{
                              fontSize: 10,
                              background: "#fdecea",
                              color: "#c62828",
                              padding: "2px 7px",
                              borderRadius: 20,
                              fontWeight: 700,
                            }}
                          >
                            Hidden
                          </span>
                        )}
                        {(() => {
                          const count = getCategoryProductCount(
                            root.categoryId,
                          );
                          return (
                            <span
                              title={`${count} product${
                                count !== 1 ? "s" : ""
                              } in this category`}
                              style={{
                                fontSize: 10,
                                background: count > 0 ? "#f3e5f5" : "#f5f5f5",
                                color: count > 0 ? "#6a1b9a" : "#9e9e9e",
                                padding: "2px 7px",
                                borderRadius: 10,
                                fontWeight: 700,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {count} {count === 1 ? "product" : "products"}
                            </span>
                          );
                        })()}
                      </div>
                      {root.description && (
                        <p
                          style={{
                            margin: "3px 0 0",
                            fontSize: 12,
                            color: "#999",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {root.description}
                        </p>
                      )}
                    </div>

                    {/* Status pill */}
                    <span
                      style={{
                        padding: "3px 11px",
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 700,
                        flexShrink: 0,
                        background:
                          root.isActive !== false ? "#e6f4ea" : "#fdecea",
                        color: root.isActive !== false ? "#2e7d32" : "#c62828",
                      }}
                    >
                      {root.isActive !== false ? "Active" : "Inactive"}
                    </span>

                    {/* Actions */}
                    <div style={{ flexShrink: 0 }}>
                      {renderActions(root as any)}
                    </div>
                  </div>

                  {/* ── Child rows (collapsible) ─────────────────────── */}
                  {expanded && kids.length > 0 && (
                    <div style={{ marginLeft: 36, marginTop: 2 }}>
                      {kids.map((kid, ki) => (
                        <div
                          key={kid.categoryId}
                          draggable
                          onDragStart={() =>
                            handleDragStart(root.categoryId, ki)
                          }
                          onDragEnter={() =>
                            handleDragEnter(root.categoryId, ki)
                          }
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => e.preventDefault()}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "8px 12px",
                            background:
                              kid.isActive !== false ? "#fdf6f9" : "#fffbf0",
                            border: `1px solid ${
                              kid.isActive !== false ? "#e8d5e3" : "#f5c6cb"
                            }`,
                            borderLeft: "3px solid #c9a8d8",
                            borderRadius: 7,
                            marginBottom: 2,
                            cursor: "grab",
                            userSelect: "none",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                          }}
                        >
                          {/* Drag handle */}
                          <span
                            style={{
                              color: "#ddd",
                              fontSize: 15,
                              flexShrink: 0,
                            }}
                          >
                            ⠿
                          </span>

                          {/* Position badge */}
                          <span
                            style={{
                              minWidth: 21,
                              height: 21,
                              borderRadius: 5,
                              background: "#ead5e8",
                              color: BRAND,
                              fontSize: 10,
                              fontWeight: 800,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            {ki + 1}
                          </span>

                          {/* spacer aligns with expand-button column above */}
                          <span style={{ width: 62, flexShrink: 0 }} />

                          {/* Thumbnail */}
                          {renderThumb(kid as any)}

                          {/* Name + description */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                flexWrap: "wrap",
                              }}
                            >
                              <span
                                style={{
                                  fontWeight: 600,
                                  fontSize: 13,
                                  color: "#333",
                                }}
                              >
                                {kid.name}
                              </span>
                              {kid.isActive === false && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    background: "#fdecea",
                                    color: "#c62828",
                                    padding: "2px 7px",
                                    borderRadius: 20,
                                    fontWeight: 700,
                                  }}
                                >
                                  Hidden
                                </span>
                              )}
                              {(() => {
                                const count =
                                  productCountMap[kid.categoryId] ?? 0;
                                return (
                                  <span
                                    title={`${count} product${
                                      count !== 1 ? "s" : ""
                                    } in this category`}
                                    style={{
                                      fontSize: 10,
                                      background:
                                        count > 0 ? "#f3e5f5" : "#f5f5f5",
                                      color: count > 0 ? "#6a1b9a" : "#9e9e9e",
                                      padding: "2px 7px",
                                      borderRadius: 10,
                                      fontWeight: 700,
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {count}{" "}
                                    {count === 1 ? "product" : "products"}
                                  </span>
                                );
                              })()}
                            </div>
                            {kid.description && (
                              <p
                                style={{
                                  margin: "2px 0 0",
                                  fontSize: 11,
                                  color: "#aaa",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {kid.description}
                              </p>
                            )}
                          </div>

                          {/* Status pill */}
                          <span
                            style={{
                              padding: "2px 9px",
                              borderRadius: 20,
                              fontSize: 10,
                              fontWeight: 700,
                              flexShrink: 0,
                              background:
                                kid.isActive !== false ? "#e6f4ea" : "#fdecea",
                              color:
                                kid.isActive !== false ? "#2e7d32" : "#c62828",
                            }}
                          >
                            {kid.isActive !== false ? "Active" : "Inactive"}
                          </span>

                          {/* Actions */}
                          <div style={{ flexShrink: 0 }}>
                            {renderActions(kid as any)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ─── View Modal ─── */}
      {viewModal && (
        <ViewCategoryModal
          cat={viewModal}
          onClose={() => setViewModal(null)}
          onEdit={() => {
            setModal(viewModal);
            setViewModal(null);
          }}
          onViewImage={(url, name, categoryId) =>
            setViewImage({ url, name, categoryId })
          }
        />
      )}

      {/* ─── Edit / Add Modal ─── */}
      {modal && (
        <div className="s-admincategor-172a23">
          <div className="s-adminbrands-cd5358">
            <h3 className="s-adminblog-e6371f">
              {modal.categoryId ? "Edit" : "New"} Category
            </h3>
            {(
              [
                ["Name *", "name"],
                ["Description", "description"],
              ] as [string, string][]
            ).map(([l, k]) => (
              <div key={k} className="s-adminblog-22a617">
                <label className="s-addressform-f1fb64">{l}</label>
                <input
                  value={modal[k] || ""}
                  onChange={(e) => setModal({ ...modal, [k]: e.target.value })}
                  className="inp-field"
                />
              </div>
            ))}
            <div className="s-adminblog-19fd7a">
              <label className="s-addressform-f1fb64">
                Parent Category ID (optional)
              </label>
              <input
                type="number"
                value={modal.parentCategoryId || ""}
                onChange={(e) =>
                  setModal({
                    ...modal,
                    parentCategoryId: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
                className="inp-field"
              />
            </div>
            <div
              style={{
                marginTop: 16,
                padding: "14px 16px",
                background: "#fafafa",
                border: "1.5px solid #ece6f0",
                borderRadius: 10,
              }}
            >
              <p
                style={{
                  margin: "0 0 12px",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#333",
                }}
              >
                🖼️ Category Image
              </p>
              {modal.categoryImage && (
                <button
                  onClick={() =>
                    setViewImage({
                      url: getImageUrl(modal.categoryImage, ""),
                      name: modal.name,
                      categoryId: modal.categoryId,
                    })
                  }
                  style={{
                    marginBottom: 10,
                    padding: "4px 12px",
                    fontSize: 11,
                    fontWeight: 600,
                    background: "#e8eaf6",
                    color: "#3949ab",
                    border: "1px solid #9fa8da",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                >
                  👁 View Current Image
                </button>
              )}
              <ImageUploadField
                categoryId={modal.categoryId}
                currentUrl={modal.categoryImage}
                onUploaded={(url) => setModal({ ...modal, categoryImage: url })}
              />
            </div>
            <div className="s-adminblog-679e96">
              <button
                onClick={() => setModal(null)}
                className="s-admincategor-68998a"
              >
                Cancel
              </button>
              <button
                onClick={() => saveMutation.mutate(modal)}
                disabled={!modal.name}
                className="s-admincategor-153727"
                style={{ opacity: !modal.name ? 0.5 : 1 }}
              >
                {saveMutation.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete Confirm ─── */}
      {confirm &&
        (() => {
          const childCount = getChildCount(confirm.categoryId);
          const isParent = childCount > 0;
          return (
            <div className="s-admincategor-172a23">
              <div className="s-adminblog-69ab70" style={{ maxWidth: 440 }}>
                <h3 className="s-adminblog-caf79d">Delete "{confirm.name}"?</h3>
                {isParent ? (
                  <>
                    <div
                      style={{
                        background: "#fff3e0",
                        border: "1px solid #ffb74d",
                        borderRadius: 8,
                        padding: "10px 14px",
                        marginBottom: 12,
                        display: "flex",
                        gap: 8,
                        alignItems: "flex-start",
                      }}
                    >
                      <span style={{ fontSize: 18 }}>⚠️</span>
                      <span
                        style={{
                          fontSize: 13,
                          color: "#e65100",
                          fontWeight: 600,
                        }}
                      >
                        This is a parent category with{" "}
                        <strong>
                          {childCount} child categor
                          {childCount === 1 ? "y" : "ies"}
                        </strong>
                        . Deleting it will also delete all its child categories
                        and <strong>make all their products inactive</strong>.
                      </span>
                    </div>
                    <p
                      style={{
                        margin: "0 0 16px",
                        fontSize: 13,
                        color: "#555",
                      }}
                    >
                      This action cannot be undone.
                    </p>
                  </>
                ) : (
                  <p className="s-adminbrands-93cf07">
                    All products in this category will become{" "}
                    <strong>inactive</strong> and hidden from the storefront.
                    This cannot be undone.
                  </p>
                )}
                <div className="s-adminblog-679e96">
                  <button
                    onClick={() => setConfirm(null)}
                    className="s-admincategor-3dc5de"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(confirm.categoryId)}
                    disabled={deleteMutation.isPending}
                    className="s-admincategor-5e62fe"
                  >
                    {deleteMutation.isPending
                      ? "Deleting…"
                      : isParent
                      ? `Delete + ${childCount} Child${
                          childCount === 1 ? "" : "ren"
                        }`
                      : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* ─── Unhide Children? (Step 1 of 2) ─── */}
      {unhideChildrenConfirm && (
        <div className="s-admincategor-172a23">
          <div className="s-adminblog-69ab70" style={{ maxWidth: 460 }}>
            <h3 className="s-adminblog-caf79d">
              Show "{unhideChildrenConfirm.cat.name}"?
            </h3>
            <div
              style={{
                background: "#e8f5e9",
                border: "1px solid #43a047",
                borderRadius: 8,
                padding: "10px 14px",
                marginBottom: 12,
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
              }}
            >
              <span style={{ fontSize: 18 }}>👁</span>
              <span style={{ fontSize: 13, color: "#2e7d32", fontWeight: 600 }}>
                This parent has{" "}
                <strong>
                  {unhideChildrenConfirm.childCount} hidden child categor
                  {unhideChildrenConfirm.childCount === 1 ? "y" : "ies"}
                </strong>
                . Would you like to make them visible too?
              </span>
            </div>
            <p style={{ fontSize: 13, color: "#555", margin: "0 0 16px" }}>
              <strong>Yes</strong> = restore all child categories (then you'll
              be asked about products). <strong>No</strong> = show only this
              parent — restore children manually later.
            </p>
            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "flex-end",
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={() => setUnhideChildrenConfirm(null)}
                className="s-admincategor-3dc5de"
              >
                Cancel
              </button>
              {/* No = just unhide parent, no products question */}
              <button
                onClick={() => {
                  doToggleVisibility.mutate({
                    id: unhideChildrenConfirm.cat.categoryId,
                    catName: unhideChildrenConfirm.cat.name,
                  });
                  setUnhideChildrenConfirm(null);
                }}
                disabled={doToggleVisibility.isPending}
                style={{
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: 7,
                  border: "1px solid #bdbdbd",
                  background: "#f5f5f5",
                  color: "#333",
                  cursor: "pointer",
                }}
              >
                No, Show Parent Only
              </button>
              {/* Yes = proceed to Step 2 (products question) */}
              <button
                onClick={() => {
                  setUnhideChildrenConfirm(null);
                  setUnhideProductsConfirm({
                    cat: unhideChildrenConfirm.cat,
                    unhideChildren: true,
                  });
                }}
                disabled={doToggleVisibility.isPending}
                style={{
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 700,
                  borderRadius: 7,
                  border: "none",
                  background: "#2e7d32",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                Yes, Show All Children Too
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete Image Confirm ─── */}
      {confirmDeleteImage && (
        <div className="s-admincategor-172a23">
          <div className="s-adminblog-69ab70">
            <h3 className="s-adminblog-caf79d">
              Remove image for "{confirmDeleteImage.name}"?
            </h3>
            <p className="s-adminbrands-93cf07">
              The image will be permanently deleted.
            </p>
            {confirmDeleteImage.categoryImage && (
              <img
                src={getImageUrl(confirmDeleteImage.categoryImage)}
                alt={confirmDeleteImage.name}
                style={{
                  width: "100%",
                  maxHeight: 140,
                  objectFit: "cover",
                  borderRadius: 8,
                  margin: "8px 0",
                }}
              />
            )}
            <div className="s-adminblog-679e96">
              <button
                onClick={() => setConfirmDeleteImage(null)}
                className="s-admincategor-3dc5de"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  deleteImageMutation.mutate(confirmDeleteImage.categoryId)
                }
                className="s-admincategor-5e62fe"
              >
                {deleteImageMutation.isPending ? "Removing…" : "Remove Image"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Unhide Products? (Step 2 of 2 for parent / standalone for child) ── */}
      {unhideProductsConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => {
            // Backdrop click = "No" — fire the toggle without cascading products
            doToggleVisibility.mutate({
              id: unhideProductsConfirm.cat.categoryId,
              catName: unhideProductsConfirm.cat.name,
              unhideChildren: unhideProductsConfirm.unhideChildren,
            });
            setUnhideProductsConfirm(null);
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              padding: "28px 28px 22px",
              maxWidth: 430,
              width: "90%",
              boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 22, marginBottom: 10 }}>👁</div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
              Also show all products under "{unhideProductsConfirm.cat.name}"
              {unhideProductsConfirm.unhideChildren
                ? " and its child categories"
                : ""}
              ?
            </div>
            <div
              style={{
                fontSize: 13,
                color: "#666",
                marginBottom: 20,
                lineHeight: 1.5,
              }}
            >
              The categor
              {unhideProductsConfirm.unhideChildren ? "ies are" : "y is"} now
              visible. Do you also want to reactivate all their products so
              customers can see them?{" "}
              <span style={{ color: "#999" }}>
                (No = products stay inactive; manage them individually from the
                Products page.)
              </span>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {/* Yes: unhide with cascadeProducts=true — ONE single API call */}
              <button
                onClick={() => {
                  doToggleVisibility.mutate({
                    id: unhideProductsConfirm.cat.categoryId,
                    catName: unhideProductsConfirm.cat.name,
                    unhideChildren: unhideProductsConfirm.unhideChildren,
                    cascadeProducts: true,
                  });
                  setUnhideProductsConfirm(null);
                }}
                disabled={doToggleVisibility.isPending}
                style={{
                  flex: 1,
                  padding: "9px 0",
                  borderRadius: 8,
                  border: "none",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  background: "#2e7d32",
                  color: "#fff",
                }}
              >
                Yes, show all products
              </button>
              {/* No: unhide WITHOUT cascading products — ONE single API call */}
              <button
                onClick={() => {
                  doToggleVisibility.mutate({
                    id: unhideProductsConfirm.cat.categoryId,
                    catName: unhideProductsConfirm.cat.name,
                    unhideChildren: unhideProductsConfirm.unhideChildren,
                  });
                  setUnhideProductsConfirm(null);
                }}
                disabled={doToggleVisibility.isPending}
                style={{
                  flex: 1,
                  padding: "9px 0",
                  borderRadius: 8,
                  border: "1.5px solid #ddd",
                  background: "#f9f9f9",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                  color: "#444",
                }}
              >
                No, manage manually
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Image Viewer ─── */}
      {viewImage && (
        <ImageViewerModal
          url={viewImage.url}
          name={viewImage.name}
          onClose={() => setViewImage(null)}
          onDelete={
            viewImage.categoryId
              ? () => {
                  const cat = allCats.find(
                    (c) => c.categoryId === viewImage.categoryId,
                  );
                  setViewImage(null);
                  setConfirmDeleteImage(
                    cat ?? {
                      categoryId: viewImage.categoryId,
                      name: viewImage.name,
                      categoryImage: viewImage.url,
                    },
                  );
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
