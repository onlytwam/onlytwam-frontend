import type { GuestWishlistItem } from "@/shared/utils/guestWishlist";
import api from "@/shared/api/axiosInstance";
import { getFamilySwatch } from "@/shared/utils/colorHelpers";
import type { ColorListItem } from "@/features/products/types/product.types";

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const getUserDashboard = async (obj: { userProfileId?: string }) => {
  const response = await api.post("/UserDashboard/GetUserDashboard", obj);
  return response.data;
};

// ── Product list ──────────────────────────────────────────────────────────────
export const listProducts = async (params: Record<string, any>) => {
  const filters: Array<{
    property: string;
    comparison: string;
    value: string;
  }> = [];

  if (params.categoryIds)
    filters.push({
      property: "Product.CategoryId",
      comparison: "in",
      value: String(params.categoryIds),
    });
  if (params.brandIds)
    filters.push({
      property: "Product.BrandId",
      comparison: "in",
      value: String(params.brandIds),
    });
  if (params.sizeIds)
    filters.push({
      property: "Size",
      comparison: "in",
      value: String(params.sizeIds),
    });
  if (params.sizeId)
    filters.push({
      property: "Size",
      comparison: "eq",
      value: String(params.sizeId),
    });
  if (params.cupSizeIds)
    filters.push({
      property: "CupSize",
      comparison: "in",
      value: String(params.cupSizeIds),
    });

  // Color — backend reads this as a raw string and handles comma-split itself
  if (params.colors)
    filters.push({
      property: "color",
      comparison: "eq",
      value: String(params.colors),
    });

  if (params.priceMin != null || params.min_price != null)
    filters.push({
      property: "MinimamPrice",
      comparison: "eq",
      value: String(params.priceMin ?? params.min_price),
    });
  if (params.priceMax != null || params.max_price != null)
    filters.push({
      property: "MaxmamPrice",
      comparison: "eq",
      value: String(params.priceMax ?? params.max_price),
    });

  if (params.quickSearch)
    filters.push({
      property: "QuickSearch",
      comparison: "",
      value: String(params.quickSearch),
    });
  if (params.isBestSeller)
    filters.push({ property: "IsBestSeller", comparison: "eq", value: "true" });

  const flatParams: Record<string, any> = {
    "page.index": params.pageNumber ?? params["page.index"] ?? 1,
    "page.size": params.pageSize ?? params["page.size"] ?? 25,
    "order.property":
      params.orderProperty ?? params["order.property"] ?? "ModifiedDate",
    "order.ascending":
      params.orderAscending !== undefined
        ? params.orderAscending
        : params["order.ascending"] ?? false,
  };

  filters.forEach((f, i) => {
    flatParams[`filters[${i}].property`] = f.property;
    flatParams[`filters[${i}].comparison`] = f.comparison;
    flatParams[`filters[${i}].value`] = f.value;
  });

  const response = await api.get(
    "/ProductVariantDetail/UserProductVariantDetail",
    { params: flatParams },
  );
  return response.data;
};

// ── Product detail ────────────────────────────────────────────────────────────
export const getProductDetail = async (id: number) => {
  const response = await api.get(
    `/ProductVariantDetail/UserProductVariant/${id}`,
  );
  return response.data;
};

// ── Categories ────────────────────────────────────────────────────────────────
export const listCategories = async (params?: any) => {
  const response = await api.get("/Category/GetProductDetailCategory", {
    params: {
      "page.size": params?.pageSize || params?.["page.size"] || 200,
      "order.property": params?.orderProperty || "DisplayOrder",
      "order.ascending": params?.orderAscending ?? true,
    },
  });
  return response.data;
};

// ── Brands ────────────────────────────────────────────────────────────────────
export const listBrands = async (params?: any) => {
  const normalized: Record<string, any> = {};
  for (const [k, v] of Object.entries(params || {})) {
    if (k === "page.pageSize") normalized["Page.Size"] = v;
    else normalized[k] = v;
  }
  if (normalized["Page.Size"] === 0 || normalized["page.size"] === 0) {
    normalized["Page.Size"] = 500;
    delete normalized["page.size"];
  }
  const response = await api.get("/Brand/", { params: normalized });
  return response.data;
};

// ── Product colors for filter sidebar ────────────────────────────────────────
// Always returns { name: string; hex: string }[] regardless of what the backend
// sends (strings or objects). This is the single normalisation point — components
// never need to call nameToHex() themselves.
export const getProductColors = async (): Promise<ColorListItem[]> => {
  const response = await api.get("/ProductVariantDetail/GetProductColor");
  const raw: any[] = response.data || [];

  return raw
    .map((c: any) => {
      // Backend returns { color, colorFamily }
      const name: string = (
        typeof c === "string" ? c : c.color ?? c.colorName ?? c.name ?? ""
      ).trim();
      const colorFamily: string | null =
        typeof c === "object" ? c.colorFamily ?? null : null;
      const hex = getFamilySwatch(colorFamily);
      return { name, colorFamily, hex };
    })
    .filter((c) => !!c.name);
};

// ── Category product counts ───────────────────────────────────────────────────
export const getCategoryProductCounts = async () => {
  const response = await api.get("/Category/GetCategoryProductCount");
  return response.data || [];
};

export const getProductMessages = async (params?: any) => {
  const response = await api.get("/UserDashboard/GetProductMessage", {
    params,
  });
  return response.data;
};

// ── User reviews ──────────────────────────────────────────────────────────────
export const listUserReviews = async (params?: Record<string, any>) => {
  const queryParams: Record<string, any> = {};

  if (params) {
    if ("productVariantId" in params || "pageSize" in params) {
      const filters: any[] = [];
      if (params.productVariantId)
        filters.push({
          property: "productVariantId",
          comparison: "eq",
          value: params.productVariantId,
        });
      if (filters.length) queryParams.Filters = JSON.stringify(filters);
      if (params.pageSize) queryParams["Page.Size"] = params.pageSize;
      queryParams["Order.Property"] = "createdDate";
      queryParams["Order.Ascending"] = false;
    } else {
      Object.assign(queryParams, params);
    }
  }

  const response = await api.get("/ProductReview", { params: queryParams });
  return response.data;
};

// export const createReview = async (data: any) => {
//   const form = new FormData();
//   Object.entries(data).forEach(([key, val]) => {
//     if (key === "photo") {
//       if (val instanceof File) form.append("photo", val);
//     } else if (val !== undefined && val !== null) {
//       form.append(key, String(val));
//     }
//   });
//   const response = await api.post("/ProductReview", form, {
//     headers: { "Content-Type": "multipart/form-data" },
//   });
//   return response.data;
// };

export const createReview = async (data: any) => {
  const form = new FormData();
  Object.entries(data).forEach(([key, val]) => {
    if (key === "photo") {
      if (val instanceof File) form.append("photo", val);
    } else if (val !== undefined && val !== null) {
      form.append(key, String(val));
    }
  });

  const token = localStorage.getItem("access_token");
  const baseURL =
    import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";

  const res = await fetch(`${baseURL}/ProductReview`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const error = new Error(err.detail || "Failed") as any;
    error.response = { status: res.status, data: err };
    throw error;
  }

  return res.json();
};
// ── Wishlist ──────────────────────────────────────────────────────────────────
export const createWishlist = async (data: any) => {
  const response = await api.post("/Wishlist", data);
  return response.data;
};

export const deleteWishlistVariant = async (id: number) => {
  const response = await api.delete(`/Wishlist/DeleteVariantWishlist/${id}`);
  return response.data;
};

export const bulkCreateWishlist = async (data: any) => {
  const response = await api.post("/Wishlist/BulkWishlist", data);
  return response.data;
};

export const listWishlist = async (params?: { userProfileId?: string }) => {
  const filters = params?.userProfileId
    ? JSON.stringify([
        {
          property: "userProfileId",
          comparison: "eq",
          value: params.userProfileId,
        },
      ])
    : undefined;

  const response = await api.get("/Wishlist", {
    params: {
      ...(filters ? { Filters: filters } : {}),
      "Order.Property": "CreatedDate",
      "Order.Ascending": false,
    },
  });

  return response.data;
};

export const createSupportRequest = async (data: any) => {
  const response = await api.post("/SupportRequest", data);
  return response.data;
};

export const listBlogs = async (params?: any) => {
  const response = await api.get("/Blog", { params });
  return response.data;
};

export const getBlogDetail = async (id: number) => {
  const response = await api.get(`/Blog/${id}`);
  return response.data;
};

// ── New Arrivals — products added in the last 6 months (backend-driven) ──────
// Uses the dedicated /NewArrivals endpoint which filters by CreatedDate server-side.
// No extra filters needed — the backend handles the 6-month window automatically.
export const listNewArrivals = async (params?: {
  pageSize?: number;
  pageIndex?: number;
}) => {
  const response = await api.get("/ProductVariantDetail/NewArrivals", {
    params: {
      "page.index": params?.pageIndex ?? 1,
      "page.size": params?.pageSize ?? 40,
    },
  });
  return response.data;
};

// ── Band/alpha sizes ──────────────────────────────────────────────────────────
// /Size is an admin-only endpoint — a 403 means the user doesn't have permission.
// We catch it and return an empty list so the page still renders; the size
// filter section simply won't appear.
export const listSizes = async (params?: any) => {
  try {
    const response = await api.get("/Size", { params });
    return response.data;
  } catch (err: any) {
    if (err?.response?.status === 403 || err?.response?.status === 401) {
      return { list: [], totalCount: 0 };
    }
    throw err;
  }
};

// ── Cup sizes ─────────────────────────────────────────────────────────────────
// Same guard as listSizes — /CupSize is also admin-only.
export const listCupSizes = async (params?: any) => {
  try {
    const response = await api.get("/CupSize", { params });
    return response.data;
  } catch (err: any) {
    if (err?.response?.status === 403 || err?.response?.status === 401) {
      return { list: [], totalCount: 0 };
    }
    throw err;
  }
};

export const syncGuestWishlist = async (
  items: GuestWishlistItem[],
  userProfileId: string,
) => {
  if (!items?.length) return { success: true };

  const response = await api.post("/Wishlist/sync", {
    createWishlistCommands: items.map((item) => ({
      productId: item.productId,
      productVariantId: item.productVariantId,
      productVariantDetailId: item.productVariantDetailId,
      state: item.state || "Active",
    })),
    userProfileId,
  });
  return response.data;
};
