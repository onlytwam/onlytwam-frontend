// ─────────────────────────────────────────────────────────────────
//  billingUtils.ts
//  Single source of truth for all billing types and pure helpers.
//  NOTE: stockId is the canonical field name everywhere — DB, API,
//        response, and frontend all must use "stockId".
// ─────────────────────────────────────────────────────────────────

// ─── Domain types ─────────────────────────────────────────────────

/**
 * Shape returned by GET /ProductVariantDetail/by-stock/{stockId}
 * Field names must match the backend response exactly.
 */
export interface Product {
  stockId: string;        // e.g. "TW723"  — primary identifier
  productName: string;    // e.g. "Cotton Bra"
  size: string;           // e.g. "34B"
  color: string;          // e.g. "White"
  price: number;          // unit price before GST
  hsnCode: string;        // e.g. "6212"
  gstPercent: number;     // e.g. 5 | 12 | 18 | 28
}

/**
 * A Product that has been added to the cart.
 * Extends Product so every cart row carries full product info.
 */
export interface CartItem extends Product {
  cartId: string;     // unique per cart row (stockId + timestamp)
  quantity: number;

  // Computed fields — recalculated on every qty / gstMode change
  subtotal: number;   // price × qty  (before GST)
  gstAmount: number;  // total GST for this row
  cgst: number;       // half of gstAmount when intrastate
  sgst: number;       // half of gstAmount when intrastate
  igst: number;       // full gstAmount when interstate
  lineTotal: number;  // subtotal + gstAmount
}

export type PaymentMethod = "cash" | "upi" | "card";
export type GSTMode = "intrastate" | "interstate";

export interface BillingState {
  cart: CartItem[];
  discount: number;
  paymentMethod: PaymentMethod;
  receivedAmount: string;
  gstMode: GSTMode;
  customerName: string;
  customerPhone: string;
}

// ─── GST calculation ──────────────────────────────────────────────

/**
 * Pure function — computes all GST fields for a given line.
 * Call this whenever price, quantity, gstPercent, or gstMode changes.
 */
export function calcGST(
  price: number,
  qty: number,
  gstPct: number,
  mode: GSTMode
) {
  const subtotal = price * qty;
  const gstAmount = parseFloat(((subtotal * gstPct) / 100).toFixed(2));
  const half = parseFloat((gstAmount / 2).toFixed(2));

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    gstAmount,
    cgst: mode === "intrastate" ? half : 0,
    sgst: mode === "intrastate" ? half : 0,
    igst: mode === "interstate" ? gstAmount : 0,
    lineTotal: parseFloat((subtotal + gstAmount).toFixed(2)),
  };
}

/**
 * Converts a freshly fetched Product into a CartItem (qty = 1).
 */
export function toCartItem(product: Product, mode: GSTMode): CartItem {
  const calc = calcGST(product.price, 1, product.gstPercent, mode);
  return {
    ...product,
    // cartId is stable within one bill session; stockId alone is not
    // unique because the same product can theoretically be re-added.
    cartId: `${product.stockId}-${Date.now()}`,
    quantity: 1,
    ...calc,
  };
}

/**
 * Recomputes all monetary fields of an existing CartItem.
 * Call after quantity change or GST mode toggle.
 */
export function recalcItem(item: CartItem, mode: GSTMode): CartItem {
  const calc = calcGST(item.price, item.quantity, item.gstPercent, mode);
  return { ...item, ...calc };
}

// ─── Formatting helpers ────────────────────────────────────────────

/** Indian locale currency formatter (no symbol, 2 decimals). */
export function fmt(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Converts a rupee amount to Indian words (for invoice). */
export function inWords(amount: number): string {
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight",
    "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen",
    "Sixteen", "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty",
    "Sixty", "Seventy", "Eighty", "Ninety",
  ];

  function convert(n: number): string {
    if (n === 0) return "";
    if (n < 20) return ones[n] + " ";
    if (n < 100) return tens[Math.floor(n / 10)] + " " + ones[n % 10] + " ";
    if (n < 1_000) return ones[Math.floor(n / 100)] + " Hundred " + convert(n % 100);
    if (n < 100_000) return convert(Math.floor(n / 1_000)) + "Thousand " + convert(n % 1_000);
    if (n < 10_000_000) return convert(Math.floor(n / 100_000)) + "Lakh " + convert(n % 100_000);
    return convert(Math.floor(n / 10_000_000)) + "Crore " + convert(n % 10_000_000);
  }

  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  let result = convert(rupees).trim() || "Zero";
  if (paise > 0) result += ` and ${convert(paise).trim()} Paise`;
  return result + " Rupees Only";
}

/** Generates a session invoice number — replace with server-issued ID in production. */
export function genInvoiceNo(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `INV-${yy}${mm}-${seq}`;
}