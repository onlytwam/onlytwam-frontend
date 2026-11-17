import { useCallback } from "react";
import { useCategories } from "@/features/products/hooks/useProducts";
import { productUrl, productSlug } from "@/shared/lib/urls";

/**
 * Returns a function that builds a full product URL (with category) from any
 * cart / order / wishlist item.
 */
export function useProductLink() {
  const { data } = useCategories({ pageSize: 200 });

  return useCallback(
    (item: any): string => {
      const id = item?.productVariantId || item?.productVariantDetailId;
      if (!id) return "/user-products/product-list";

      const cat = (data?.list ?? []).find(
        (c: any) => c.categoryId === Number(item?.categoryId),
      );

      return productUrl({
        id,
        name: item?.productName || item?.name || "product",
        color: item?.colorName || item?.color,
        category:
          item?.categorySlug || (cat ? productSlug(cat.name || "") : ""),
      });
    },
    [data],
  );
}