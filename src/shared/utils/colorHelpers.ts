export const FALLBACK_COLOR_FAMILY_HEX = "#d0c8c2";

export interface ColorFamilyOption {
  id: number;
  name: string;
  hex: string;
  orderNo?: number | null;
  isActive?: boolean;
}

function firstString(source: any, keys: string[]): string {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function firstNumber(source: any, keys: string[]): number | null {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
      return Number(value);
    }
  }
  return null;
}

export function normalizeColorFamily(source: any): ColorFamilyOption | null {
  const id = firstNumber(source, [
    "productColorId",
    "colorFamilyId",
    "ColorFamilyId",
    "id",
  ]);
  const name = firstString(source, [
    "colorFamilyName",
    "colorFamily",
    "name",
    "ColorFamilyName",
  ]);
  if (!id || !name) return null;

  return {
    id,
    name,
    hex:
      firstString(source, [
        "hexCode",
        "colorFamilyHex",
        "hex",
        "HexCode",
      ]) || FALLBACK_COLOR_FAMILY_HEX,
    orderNo: firstNumber(source, ["orderNo", "OrderNo"]),
    isActive:
      typeof source?.isActive === "boolean"
        ? source.isActive
        : typeof source?.IsActive === "boolean"
          ? source.IsActive
          : true,
  };
}

export function colorFamilyIdOf(source: any): number | null {
  return firstNumber(source, [
    "colorFamilyId",
    "ColorFamilyId",
    "productColorId",
    "ProductColorId",
  ]);
}

export function colorFamilyNameOf(source: any): string {
  return firstString(source, [
    "colorFamily",
    "colorFamilyName",
    "ColorFamilyName",
    "ColorFamily",
  ]);
}

export function colorFamilyHexOf(source: any): string {
  return (
    firstString(source, [
      "colorFamilyHex",
      "hexCode",
      "HexCode",
      "hex",
    ]) || FALLBACK_COLOR_FAMILY_HEX
  );
}
