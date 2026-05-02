/**
 * surpriseGift.ts
 *
 * Surprise-gift tier helpers.
 * Tiers are now fetched from the backend (admin-configurable) instead of
 * being hardcoded. A local cache is kept in module scope so we only hit the
 * API once per page-load.
 */

import api from "@/shared/api/axiosInstance";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SurpriseGiftTier = {
  giftRuleId: number;
  threshold: number;
  label: string;
  displayPrice: number;
  giftType: string;
};

/** Kept for backward compat with checkoutSession and Cart.tsx */
export type SurpriseGiftSelection = SurpriseGiftTier & {
  internalGiftId: string;
};

// ── Internal cache ─────────────────────────────────────────────────────────

let _cachedTiers: SurpriseGiftTier[] | null = null;
let _fetchPromise: Promise<SurpriseGiftTier[]> | null = null;

async function _fetchTiers(): Promise<SurpriseGiftTier[]> {
  if (_cachedTiers) return _cachedTiers;
  if (_fetchPromise) return _fetchPromise;

  _fetchPromise = api
    .get<{ tiers: SurpriseGiftTier[] }>("/SurpriseGift/Tiers")
    .then((res) => {
      const tiers: SurpriseGiftTier[] = (res.data?.tiers ?? []).map((t) => ({
        giftRuleId: t.giftRuleId,
        threshold: Number(t.threshold),
        label: t.label ?? "Surprise Gift",
        displayPrice: 0,
        giftType: t.giftType ?? "physical_gift",
      }));
      tiers.sort((a, b) => b.threshold - a.threshold);
      _cachedTiers = tiers;
      _fetchPromise = null;
      return tiers;
    })
    .catch((err) => {
      console.warn("[surpriseGift] Failed to fetch tiers:", err);
      _fetchPromise = null;
      _cachedTiers = _cachedTiers ?? [];
      return _cachedTiers;
    });

  return _fetchPromise;
}

export const prefetchSurpriseGiftTiers = () => _fetchTiers();
export const invalidateSurpriseGiftTiersCache = () => {
  _cachedTiers = null;
  _fetchPromise = null;
};

export const getSurpriseGiftTiers = (): Promise<SurpriseGiftTier[]> =>
  _fetchTiers();

export const getSurpriseGiftTier = async (
  cartValue: number,
): Promise<SurpriseGiftTier | null> => {
  const amount = Number(cartValue);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const tiers = await _fetchTiers();
  return tiers.find((t) => amount >= t.threshold) ?? null;
};

export const getSurpriseGiftSelection = async (
  cartValue: number,
): Promise<SurpriseGiftSelection | null> => {
  const tier = await getSurpriseGiftTier(cartValue);
  if (!tier) return null;
  return { ...tier, internalGiftId: String(tier.giftRuleId) };
};

export const getSurpriseGiftSelectionSync = (
  cartValue: number,
): SurpriseGiftSelection | null => {
  if (!_cachedTiers) return null;
  const amount = Number(cartValue);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const tier = _cachedTiers.find((t) => amount >= t.threshold) ?? null;
  if (!tier) return null;
  return { ...tier, internalGiftId: String(tier.giftRuleId) };
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
        `${String(item.productVariantId ?? "")}:${
          Number(item.processedQuantity ?? 1) || 1
        }:${Number(item.finalPrice ?? 0) || 0}`,
    )
    .sort()
    .join("|");

// Legacy export for any imports that destructure this
export const SURPRISE_GIFT_TIERS: SurpriseGiftTier[] = [];
