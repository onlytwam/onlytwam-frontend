export function toFiniteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function getVariantPrice(variant: any): number {
  return (
    toFiniteNumber(variant?.finalPrice) ??
    toFiniteNumber(variant?.minFinalPrice) ??
    toFiniteNumber(variant?.price) ??
    toFiniteNumber(variant?.minPrice) ??
    toFiniteNumber(variant?.sellingPrice) ??
    0
  );
}

export function getVariantMrp(variant: any): number {
  return (
    toFiniteNumber(variant?.mrpPrice) ??
    toFiniteNumber(variant?.minMrpPrice) ??
    toFiniteNumber(variant?.oldPrice) ??
    toFiniteNumber(variant?.originalPrice) ??
    0
  );
}

function getStock(variant: any): number | null {
  return (
    toFiniteNumber(variant?.stock) ??
    toFiniteNumber(variant?.minStock) ??
    toFiniteNumber(variant?.availableQuantity) ??
    toFiniteNumber(variant?.stockQuantity) ??
    null
  );
}

function hasAvailableStock(variant: any): boolean {
  const stock = getStock(variant);
  return stock === null || stock > 0;
}

export function compareByLowestPrice(a: any, b: any): number {
  const priceDiff = getVariantPrice(a) - getVariantPrice(b);
  if (priceDiff !== 0) return priceDiff;

  const variantDiff =
    (toFiniteNumber(a?.productVariantId) ?? 0) -
    (toFiniteNumber(b?.productVariantId) ?? 0);
  if (variantDiff !== 0) return variantDiff;

  return (
    (toFiniteNumber(a?.productVariantDetailId) ?? 0) -
    (toFiniteNumber(b?.productVariantDetailId) ?? 0)
  );
}

export function normalizeVariantPriceFields<T extends Record<string, any>>(
  variant: T,
): T {
  const price = getVariantPrice(variant);
  const oldPrice = getVariantMrp(variant);
  return {
    ...variant,
    price,
    finalPrice: toFiniteNumber(variant?.finalPrice) ?? price,
    oldPrice,
    mrpPrice: toFiniteNumber(variant?.mrpPrice) ?? oldPrice,
  };
}

export function getCheapestVariant<T extends Record<string, any>>(
  variants: T[] | undefined,
): T | null {
  const list = (variants ?? []).filter(Boolean);
  if (!list.length) return null;

  const inStock = list.filter(hasAvailableStock);
  const pool = inStock.length ? inStock : list;
  return [...pool].sort(compareByLowestPrice)[0] ?? null;
}

export function sortVariantsByLowestPrice<T extends Record<string, any>>(
  variants: T[] | undefined,
): T[] {
  return [...(variants ?? [])].sort(compareByLowestPrice);
}

export function getDefaultProductVariant<T extends Record<string, any>>(
  product: T,
): T {
  const variants = Array.isArray(product?.allVariants)
    ? product.allVariants
    : [];
  const cheapest = getCheapestVariant<T>(variants.length ? variants : [product]);
  const normalized = normalizeVariantPriceFields((cheapest ?? product) as T);

  return {
    ...normalized,
    allVariants: variants.length
      ? sortVariantsByLowestPrice(variants).map((v) =>
          normalizeVariantPriceFields(v),
        )
      : product?.allVariants,
  };
}

export function getCheapestPvdRow<T extends Record<string, any>>(
  rows: T[] | undefined,
): T | null {
  return getCheapestVariant(rows);
}
