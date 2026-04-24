export type SurpriseGiftTier = {
  threshold: number;
  internalGiftId: string;
};

export type SurpriseGiftSelection = SurpriseGiftTier & {
  label: string;
  displayPrice: number;
};

export const SURPRISE_GIFT_TIERS: SurpriseGiftTier[] = [
  { threshold: 10000, internalGiftId: "GIFT_10000" },
  { threshold: 7500, internalGiftId: "GIFT_7500" },
  { threshold: 5000, internalGiftId: "GIFT_5000" },
  { threshold: 2500, internalGiftId: "GIFT_2500" },
];

export const getSurpriseGiftTier = (
  cartValue: number,
): SurpriseGiftTier | null => {
  const amount = Number(cartValue);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  return SURPRISE_GIFT_TIERS.find((tier) => amount >= tier.threshold) ?? null;
};

export const getSurpriseGiftSelection = (
  cartValue: number,
): SurpriseGiftSelection | null => {
  const tier = getSurpriseGiftTier(cartValue);
  if (!tier) return null;

  return {
    ...tier,
    label: "Surprise Gift",
    displayPrice: 0,
  };
};

export const buildSurpriseGiftSignature = (
  items: Array<{
    productVariantId?: string | number | null;
    processedQuantity?: string | number | null;
    finalPrice?: string | number | null;
  }> = [],
) =>
  items
    .map(
      (item) =>
        `${String(item.productVariantId ?? "")}:${Number(
          item.processedQuantity ?? 1,
        ) || 1}:${Number(item.finalPrice ?? 0) || 0}`,
    )
    .sort()
    .join("|");
