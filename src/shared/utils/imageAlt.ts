export const productImageAlt = (name?: string, color?: string, view?: string) => {
  const n = (name || "").trim();
  const c = (color || "").trim();
  const base = c && !n.toLowerCase().includes(c.toLowerCase()) ? `${n} - ${c}` : n;
  return [base || "TWAM product", view].filter(Boolean).join(" - ");
};
