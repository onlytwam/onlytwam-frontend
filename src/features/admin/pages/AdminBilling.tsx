// =============================================================
//  AdminBilling.tsx  —  TWAM POS Billing Module
//
//  API contract (FastAPI):
//    GET  /Billing/product/{stockId}   → ProductLookupOut
//    POST /Billing/orders              → CreateOrderOut
//
//  Brand:
//    Burgundy      #6B0F2A
//    Heirloom Rose #9E6070
//    Blush Pink    #A84C6B
//    Warm Ivory    #F5F0E6
// =============================================================

import { useState, useRef, useCallback, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useReactToPrint } from "react-to-print";
import api from "@/shared/api/axiosInstance";
import toast from "react-hot-toast";

// =============================================================
//  TYPES
// =============================================================

interface Product {
  stockId:           string;
  productName:       string;
  size:              string;
  color:             string;
  price:             number;
  mrpPrice:          number;
  hsnCode:           string;
  gstPercent:        number;
  availableQuantity: number;
}

interface CartItem extends Product {
  cartId:    string;
  quantity:  number;
  subtotal:  number;   // price × qty
  gstAmount: number;
  cgst:      number;
  sgst:      number;
  igst:      number;
  lineTotal:  number;  // subtotal + gstAmount
}

type PaymentMethod = "cash" | "upi" | "card";
type GSTMode       = "intrastate" | "interstate";

// =============================================================
//  PURE HELPERS
// =============================================================

function calcLine(price: number, qty: number, gstPct: number, mode: GSTMode) {
  const subtotal  = parseFloat((price * qty).toFixed(2));
  const gstAmount = parseFloat(((subtotal * gstPct) / 100).toFixed(2));
  const half      = parseFloat((gstAmount / 2).toFixed(2));
  return {
    subtotal,
    gstAmount,
    cgst:      mode === "intrastate" ? half       : 0,
    sgst:      mode === "intrastate" ? half       : 0,
    igst:      mode === "interstate" ? gstAmount  : 0,
    lineTotal: parseFloat((subtotal + gstAmount).toFixed(2)),
  };
}

function toCartItem(p: Product, mode: GSTMode): CartItem {
  return {
    ...p,
    cartId:   `${p.stockId}-${Date.now()}`,
    quantity: 1,
    ...calcLine(p.price, 1, p.gstPercent, mode),
  };
}

function recalc(item: CartItem, mode: GSTMode): CartItem {
  return { ...item, ...calcLine(item.price, item.quantity, item.gstPercent, mode) };
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function inWords(amount: number): string {
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  function convert(n: number): string {
    if (n === 0) return "";
    if (n < 20)  return ones[n] + " ";
    if (n < 100) return tens[Math.floor(n/10)] + " " + ones[n%10] + " ";
    if (n < 1_000)     return ones[Math.floor(n/100)] + " Hundred " + convert(n%100);
    if (n < 100_000)   return convert(Math.floor(n/1000)) + "Thousand " + convert(n%1000);
    if (n < 10_000_000) return convert(Math.floor(n/100_000)) + "Lakh " + convert(n%100_000);
    return convert(Math.floor(n/10_000_000)) + "Crore " + convert(n%10_000_000);
  }
  const r = Math.floor(amount);
  const p = Math.round((amount - r) * 100);
  let out = convert(r).trim() || "Zero";
  if (p > 0) out += ` and ${convert(p).trim()} Paise`;
  return out + " Rupees Only";
}

// =============================================================
//  STORE CONFIG  — update to match your store
// =============================================================

const STORE = {
  name:    "TWAM",
  address: "123 Fashion Street, Hyderabad, Telangana - 500001",
  phone:   "+91 40 1234 5678",
  gstin:   "36AABCT1234A1Z5",
};

// =============================================================
//  SUB-COMPONENTS
// =============================================================

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: "0.4rem 1rem", borderRadius: 999, fontFamily: "inherit",
      border: active ? "none" : "1.5px solid #ddd0c8",
      background: active ? "#6B0F2A" : "transparent",
      color: active ? "#F5F0E6" : "#9E6070",
      fontWeight: 600, fontSize: "0.78rem", cursor: "pointer",
      transition: "all 0.15s", letterSpacing: "0.02em",
    }}>{label}</button>
  );
}

function IconBtn({ onClick, title, danger, children }: {
  onClick: () => void; title?: string; danger?: boolean; children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} title={title} style={{
      border: "none", background: "transparent", cursor: "pointer",
      color: danger ? "#c97070" : "#9E6070", padding: 4, borderRadius: 6,
      display: "flex", alignItems: "center", transition: "background 0.12s, color 0.12s",
    }}
    onMouseOver={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = danger ? "#fef2f2" : "#f0e8ec"; el.style.color = danger ? "#dc2626" : "#6B0F2A"; }}
    onMouseOut={(e)  => { const el = e.currentTarget as HTMLElement; el.style.background = "transparent"; el.style.color = danger ? "#c97070" : "#9E6070"; }}
    >{children}</button>
  );
}

function QtyBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.background = "#f0e0e7"; }}
      onMouseOut={(e)  => { (e.currentTarget as HTMLElement).style.background = "#fdf8f4"; }}
      style={{ width: 26, height: 26, borderRadius: 6, border: "1.5px solid #ddd0c8",
        background: "#fdf8f4", color: "#6B0F2A", fontWeight: 800, fontSize: 15,
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "inherit", lineHeight: 1, transition: "background 0.12s" }}>
      {children}
    </button>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "#fff", border: "1.5px solid #e8ddd5", borderRadius: 14, ...style }}>
      {children}
    </div>
  );
}

function CardHeader({ icon, title, right }: { icon: React.ReactNode; title: string; right?: React.ReactNode }) {
  return (
    <div style={{ padding: "13px 18px", borderBottom: "1.5px solid #f0e8e4", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        {icon}
        <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "1rem", fontWeight: 700, color: "#6B0F2A" }}>{title}</span>
      </div>
      {right}
    </div>
  );
}

function SumRow({ label, value, bold, highlight, green, muted }: {
  label: string; value: string; bold?: boolean; highlight?: boolean; green?: boolean; muted?: boolean;
}) {
  if (highlight) return (
    <div style={{ display: "flex", justifyContent: "space-between", background: "#6B0F2A", borderRadius: 8, padding: "10px 14px", marginTop: 6 }}>
      <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#F5F0E6" }}>{label}</span>
      <span style={{ fontSize: "0.95rem", fontWeight: 800, color: "#F5F0E6" }}>{value}</span>
    </div>
  );
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderTop: "1px dotted #e8ddd5" }}>
      <span style={{ fontSize: "0.8rem", fontWeight: muted ? 400 : 500, color: muted ? "#9E6070" : "#3b1c25" }}>{label}</span>
      <span style={{ fontSize: "0.8rem", fontWeight: bold ? 700 : 600, color: green ? "#16a34a" : "#3b1c25" }}>{value}</span>
    </div>
  );
}

function Spinner({ size = 16, ivory = false }: { size?: number; ivory?: boolean }) {
  return (
    <svg className="spin" width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ color: ivory ? "#F5F0E6" : "#6B0F2A" }}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity: .25 }} />
      <path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" style={{ opacity: .75 }} />
    </svg>
  );
}

// =============================================================
//  INVOICE PRINT COMPONENT
// =============================================================

interface InvoiceData {
  invoiceNo:      string;
  date:           string;
  customerName:   string;
  customerPhone:  string;
  cart:           CartItem[];
  subtotal:       number;
  cgstTotal:      number;
  sgstTotal:      number;
  igstTotal:      number;
  gstTotal:       number;
  discount:       number;
  grandTotal:     number;
  gstMode:        GSTMode;
  paymentMethod:  PaymentMethod;
  receivedAmount: number;
  balance:        number;
}

function InvoicePrint({ data }: { data: InvoiceData }) {
  const { invoiceNo, date, customerName, customerPhone, cart,
          subtotal, cgstTotal, sgstTotal, igstTotal, gstTotal,
          discount, grandTotal, gstMode, paymentMethod,
          receivedAmount, balance } = data;

  const td = (content: React.ReactNode, align: "left"|"right"|"center" = "left", bold = false): React.ReactNode => (
    <td style={{ padding: "6px 8px", textAlign: align, fontWeight: bold ? 700 : 400, fontSize: 11, borderBottom: "1px solid #f0e8e4", verticalAlign: "middle" }}>
      {content}
    </td>
  );

  return (
    <div style={{ fontFamily: "Arial, sans-serif", background: "#fff", color: "#1a1a1a", padding: "24px 28px", maxWidth: 740, margin: "0 auto", fontSize: 12 }}>
      {/* Store header */}
      <div style={{ textAlign: "center", borderBottom: "2.5px solid #6B0F2A", paddingBottom: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#6B0F2A", letterSpacing: 1 }}>{STORE.name}</div>
        <div style={{ color: "#555", fontSize: 11, marginTop: 3 }}>{STORE.address}</div>
        <div style={{ color: "#555", fontSize: 11, marginTop: 2 }}>📞 {STORE.phone} &nbsp;|&nbsp; GSTIN: {STORE.gstin}</div>
      </div>

      {/* Invoice title */}
      <div style={{ textAlign: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 3, color: "#6B0F2A", textTransform: "uppercase" }}>Tax Invoice</div>
      </div>

      {/* Bill To / Invoice Details */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 10, color: "#6B0F2A", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Bill To</div>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{customerName || "Walk-in Customer"}</div>
          {customerPhone && <div style={{ color: "#555", marginTop: 2 }}>📞 {customerPhone}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 700, fontSize: 10, color: "#6B0F2A", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Invoice Details</div>
          <div style={{ color: "#555" }}>Invoice No: <strong style={{ color: "#6B0F2A" }}>{invoiceNo}</strong></div>
          <div style={{ color: "#555", marginTop: 2 }}>Date: <strong>{date}</strong></div>
        </div>
      </div>

      {/* Items table */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 14 }}>
        <thead>
          <tr style={{ background: "#6B0F2A" }}>
            {["#", "Stock ID", "Product", "Size", "Color", "HSN", "Qty", "Rate", gstMode === "intrastate" ? "CGST+SGST" : "IGST", "Amount"].map((h, i) => (
              <th key={i} style={{ padding: "7px 8px", color: "#F5F0E6", fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textAlign: ["Rate", "CGST+SGST", "IGST", "Amount"].includes(h) ? "right" : h === "#" || h === "Qty" ? "center" : "left", whiteSpace: "nowrap" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cart.map((item, i) => (
            <tr key={item.cartId} style={{ background: i % 2 === 0 ? "#fff" : "#fdf8f4" }}>
              {td(i + 1, "center")}
              {td(<span style={{ fontFamily: "monospace", fontSize: 10, color: "#9E6070" }}>{item.stockId}</span>)}
              {td(item.productName, "left", true)}
              {td(item.size)}
              {td(item.color)}
              {td(<span style={{ fontSize: 10, color: "#555" }}>{item.hsnCode}</span>)}
              {td(item.quantity, "center")}
              {td(`₹${fmt(item.price)}`, "right")}
              {td(
                gstMode === "intrastate"
                  ? <><div>₹{fmt(item.cgst)}</div><div style={{ color: "#9E6070", fontSize: 9 }}>({item.gstPercent/2}%+{item.gstPercent/2}%)</div></>
                  : <><div>₹{fmt(item.igst)}</div><div style={{ color: "#9E6070", fontSize: 9 }}>({item.gstPercent}%)</div></>,
                "right"
              )}
              {td(`₹${fmt(item.lineTotal)}`, "right", true)}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: "2px solid #6B0F2A" }}>
            <td colSpan={6} style={{ padding: "7px 8px", fontWeight: 700, fontSize: 11 }}>Total</td>
            <td style={{ padding: "7px 8px", textAlign: "center", fontWeight: 700, fontSize: 11 }}>{cart.reduce((s, i) => s + i.quantity, 0)}</td>
            <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700, fontSize: 11 }}>₹{fmt(subtotal)}</td>
            <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700, fontSize: 11 }}>₹{fmt(gstTotal)}</td>
            <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 800, fontSize: 12, color: "#6B0F2A" }}>₹{fmt(grandTotal + discount)}</td>
          </tr>
        </tfoot>
      </table>

      {/* Amount in words + summary */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 24, marginBottom: 16 }}>
        <div style={{ flex: 1, background: "#fdf8f4", border: "1px solid #e8ddd5", borderRadius: 8, padding: "10px 14px" }}>
          <div style={{ fontWeight: 700, fontSize: 9, color: "#6B0F2A", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 }}>Amount In Words</div>
          <div style={{ fontWeight: 600, fontStyle: "italic", fontSize: 11, color: "#3b1c25", lineHeight: 1.5 }}>{inWords(grandTotal)}</div>
          <div style={{ marginTop: 10, borderTop: "1px solid #e8ddd5", paddingTop: 8 }}>
            <div style={{ fontSize: 10, color: "#555" }}>Payment: <strong style={{ textTransform: "capitalize" }}>{paymentMethod}</strong></div>
            {receivedAmount > 0 && <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>Received: <strong>₹{fmt(receivedAmount)}</strong></div>}
            {balance !== 0 && <div style={{ fontSize: 10, color: balance > 0 ? "#16a34a" : "#dc2626", marginTop: 2 }}>{balance > 0 ? "Change: " : "Balance Due: "}<strong>₹{fmt(Math.abs(balance))}</strong></div>}
          </div>
        </div>

        <div style={{ minWidth: 210 }}>
          {([
            ["Sub Total",   `₹${fmt(subtotal)}`],
            ...(gstMode === "intrastate"
              ? [["CGST", `₹${fmt(cgstTotal)}`], ["SGST", `₹${fmt(sgstTotal)}`]]
              : [["IGST", `₹${fmt(igstTotal)}`]]),
            ...(discount > 0 ? [["Discount", `-₹${fmt(discount)}`]] : []),
          ] as [string,string][]).map(([l, v]) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px dotted #e8ddd5", fontSize: 11 }}>
              <span style={{ color: "#555" }}>{l}</span>
              <span style={{ color: l === "Discount" ? "#16a34a" : "#1a1a1a" }}>{v}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", background: "#6B0F2A", color: "#F5F0E6", borderRadius: 6, padding: "8px 10px", marginTop: 6, fontWeight: 800, fontSize: 13 }}>
            <span>Grand Total</span><span>₹{fmt(grandTotal)}</span>
          </div>
        </div>
      </div>

      <div style={{ borderTop: "1.5px solid #e8ddd5", paddingTop: 10, textAlign: "center", color: "#9E6070", fontSize: 10 }}>
        Thank you for shopping with us! — Computer-generated invoice, no signature required.
      </div>
    </div>
  );
}

// =============================================================
//  MAIN COMPONENT
// =============================================================

export default function AdminBilling() {
  // ── State ─────────────────────────────────────────────────
  const [stockInput,      setStockInput]      = useState("");
  const [scanLoading,     setScanLoading]     = useState(false);
  const [scanError,       setScanError]       = useState<string | null>(null);
  const [lastScanned,     setLastScanned]     = useState<Product | null>(null);
  const [cart,            setCart]            = useState<CartItem[]>([]);
  const [gstMode,         setGstMode]         = useState<GSTMode>("intrastate");
  const [customerName,    setCustomerName]    = useState("");
  const [customerPhone,   setCustomerPhone]   = useState("");
  const [discount,        setDiscount]        = useState("");
  const [paymentMethod,   setPaymentMethod]   = useState<PaymentMethod>("cash");
  const [receivedAmount,  setReceivedAmount]  = useState("");
  const [showInvoice,     setShowInvoice]     = useState(false);
  const [invoiceData,     setInvoiceData]     = useState<InvoiceData | null>(null);

  const scanRef  = useRef<HTMLInputElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scanRef.current?.focus(); }, []);

  // ── Totals ────────────────────────────────────────────────
  const subtotal    = parseFloat(cart.reduce((s, i) => s + i.subtotal, 0).toFixed(2));
  const cgstTotal   = parseFloat(cart.reduce((s, i) => s + i.cgst, 0).toFixed(2));
  const sgstTotal   = parseFloat(cart.reduce((s, i) => s + i.sgst, 0).toFixed(2));
  const igstTotal   = parseFloat(cart.reduce((s, i) => s + i.igst, 0).toFixed(2));
  const gstTotal    = parseFloat(cart.reduce((s, i) => s + i.gstAmount, 0).toFixed(2));
  const discountAmt = parseFloat(discount) || 0;
  const grandTotal  = parseFloat((subtotal + gstTotal - discountAmt).toFixed(2));
  const received    = parseFloat(receivedAmount) || 0;
  const balance     = parseFloat((received - grandTotal).toFixed(2));

  // ── Scan / fetch product ──────────────────────────────────
  const fetchProduct = useCallback(async (raw: string) => {
    const id = raw.trim().toUpperCase();
    if (!id) return;

    setScanLoading(true);
    setScanError(null);

    try {
      const res = await api.get<Product>(`/Billing/product/${encodeURIComponent(id)}`);
      const p   = res.data;

      if (!p?.stockId) throw new Error("Unexpected server response.");

      setLastScanned(p);
      setCart(prev => {
        const existing = prev.find(i => i.stockId === p.stockId);
        if (existing) {
          return prev.map(i =>
            i.stockId === p.stockId
              ? recalc({ ...i, quantity: i.quantity + 1 }, gstMode)
              : i
          );
        }
        return [...prev, toCartItem(p, gstMode)];
      });

      toast.success(`Added: ${p.productName} (${p.size} / ${p.color})`);
      setStockInput("");
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        "Product not found. Please check the Stock ID.";
      setScanError(msg);
      toast.error(msg);
    } finally {
      setScanLoading(false);
      setTimeout(() => scanRef.current?.focus(), 50);
    }
  }, [gstMode]);

  // ── GST mode toggle ───────────────────────────────────────
  const toggleGSTMode = (mode: GSTMode) => {
    setGstMode(mode);
    setCart(prev => prev.map(i => recalc(i, mode)));
  };

  // ── Cart ops ──────────────────────────────────────────────
  const bumpQty = (cartId: string, delta: number) =>
    setCart(prev =>
      prev
        .map(i => i.cartId === cartId ? recalc({ ...i, quantity: i.quantity + delta }, gstMode) : i)
        .filter(i => i.quantity > 0)
    );

  const setQty = (cartId: string, val: number) => {
    if (isNaN(val) || val < 0) return;
    setCart(prev =>
      val === 0
        ? prev.filter(i => i.cartId !== cartId)
        : prev.map(i => i.cartId === cartId ? recalc({ ...i, quantity: val }, gstMode) : i)
    );
  };

  const removeItem = (cartId: string) => setCart(prev => prev.filter(i => i.cartId !== cartId));
  const clearCart  = () => { setCart([]); setLastScanned(null); setScanError(null); };

  // ── Save order ────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ orderId: number; invoiceNo: string }>("/Billing/orders", {
        customerName:   customerName   || null,
        customerPhone:  customerPhone  || null,
        gstMode,
        paymentMethod,
        items: cart.map(i => ({
          stockId:     i.stockId,
          productName: i.productName,
          size:        i.size,
          color:       i.color,
          hsnCode:     i.hsnCode,
          gstPercent:  i.gstPercent,
          price:       i.price,
          quantity:    i.quantity,
          subtotal:    i.subtotal,
          gstAmount:   i.gstAmount,
          cgst:        i.cgst,
          sgst:        i.sgst,
          igst:        i.igst,
          lineTotal:   i.lineTotal,
        })),
        subtotal,
        gstTotal,
        cgstTotal,
        sgstTotal,
        igstTotal,
        discount:       discountAmt,
        grandTotal,
        receivedAmount: received,
        balance,
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Bill ${data.invoiceNo} saved!`);
      setInvoiceData({
        invoiceNo:      data.invoiceNo,
        date:           new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }),
        customerName:   customerName || "Walk-in Customer",
        customerPhone,
        cart:           [...cart],
        subtotal,
        cgstTotal,
        sgstTotal,
        igstTotal,
        gstTotal,
        discount:       discountAmt,
        grandTotal,
        gstMode,
        paymentMethod,
        receivedAmount: received,
        balance,
      });
      setShowInvoice(true);
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail || "Failed to save order. Please try again."),
  });

  const handleGenerate = () => {
    if (!cart.length) { toast.error("Cart is empty."); return; }
    saveMutation.mutate();
  };

  // ── Print ─────────────────────────────────────────────────
  const handlePrint = useReactToPrint({ contentRef: printRef });

  const handleNewBill = () => {
    clearCart();
    setCustomerName(""); setCustomerPhone("");
    setDiscount(""); setReceivedAmount("");
    setPaymentMethod("cash");
    setShowInvoice(false); setInvoiceData(null);
    setTimeout(() => scanRef.current?.focus(), 100);
  };

  // ── Icons (inline SVG to keep zero extra deps) ────────────
  const icn = (d: string) => (
    <svg width="15" height="15" fill="none" stroke="#6B0F2A" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );

  // =============================================================
  //  RENDER
  // =============================================================
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Sans:wght@400;500;600&display=swap');
        .ab-root *, .ab-root *::before, .ab-root *::after { box-sizing: border-box; }
        .ab-root { font-family: 'DM Sans', sans-serif; background: #F5F0E6; min-height: 100vh; color: #3b1c25; }
        .serif  { font-family: 'Cormorant Garamond', Georgia, serif; }

        /* Input */
        .inp { width: 100%; border: 1.5px solid #ddd0c8; border-radius: 8px; background: #fff; padding: 0.62rem 0.875rem; font-size: 0.875rem; color: #3b1c25; font-family: inherit; outline: none; transition: border-color .15s, box-shadow .15s; box-shadow: 0 1px 3px rgba(107,15,42,.05); }
        .inp::placeholder { color: #b89aa6; }
        .inp:focus { border-color: #6B0F2A; box-shadow: 0 0 0 3px rgba(107,15,42,.10); }
        .lbl  { font-size: .67rem; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #9E6070; display: block; margin-bottom: 5px; }

        /* Buttons */
        .btn  { display: inline-flex; align-items: center; gap: 7px; font-family: 'DM Sans',sans-serif; font-weight: 600; cursor: pointer; border: none; transition: all .15s; }
        .btn-p { background: #6B0F2A; color: #F5F0E6; border-radius: 9px; padding: .65rem 1.375rem; font-size: .875rem; box-shadow: 0 2px 10px rgba(107,15,42,.28); }
        .btn-p:hover:not(:disabled) { background: #8a1235; transform: translateY(-1px); box-shadow: 0 4px 16px rgba(107,15,42,.36); }
        .btn-p:disabled { opacity: .6; cursor: not-allowed; }
        .btn-s { background: transparent; color: #6B0F2A; border: 1.5px solid #ddd0c8; border-radius: 8px; padding: .55rem 1.1rem; font-size: .8rem; }
        .btn-s:hover { border-color: #9E6070; background: #fdf4f7; }

        /* Cart table */
        .ct { width: 100%; border-collapse: collapse; }
        .ct thead tr { background: #6B0F2A; }
        .ct th { padding: 9px 10px; color: #F5F0E6; font-size: .68rem; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; white-space: nowrap; }
        .ct th:first-child { border-radius: 8px 0 0 0; } .ct th:last-child { border-radius: 0 8px 0 0; }
        .ct tbody tr { border-bottom: 1px solid #f0e8e4; transition: background .12s; }
        .ct tbody tr:hover { background: #fdf8f4; }
        .ct td { padding: 8px 10px; font-size: .8rem; vertical-align: middle; }
        .ct tfoot tr { border-top: 2px solid #e8ddd5; background: #fdf8f4; }
        .ct tfoot td { padding: 9px 10px; font-weight: 700; font-size: .82rem; }

        /* Payment cards */
        .pm  { border: 2px solid transparent; border-radius: 10px; padding: 11px 8px; cursor: pointer; transition: all .15s; background: #fdf8f4; text-align: center; flex: 1; }
        .pm.on  { border-color: #6B0F2A; background: #f0e0e7; }
        .pm:hover:not(.on) { border-color: #ddd0c8; background: #fff; }

        /* Modal */
        .mb { position: fixed; inset: 0; z-index: 100; background: rgba(59,28,37,.52); backdrop-filter: blur(5px); display: flex; align-items: flex-start; justify-content: center; padding: 1.5rem 1rem; overflow-y: auto; }
        .mbox { background: #fff; border-radius: 18px; width: 100%; max-width: 800px; box-shadow: 0 30px 80px rgba(107,15,42,.26); border: 1.5px solid #e8ddd5; animation: mIn .22s cubic-bezier(.34,1.56,.64,1); }
        @keyframes mIn { from { opacity:0; transform: scale(.95) translateY(14px); } to { opacity:1; transform: scale(1) translateY(0); } }

        /* Alerts */
        .err { display: flex; align-items: flex-start; gap: 8px; background: #fef2f2; border: 1.5px solid #fecaca; border-radius: 9px; padding: 10px 14px; color: #b91c1c; font-size: .8rem; font-weight: 500; margin-top: 10px; line-height: 1.4; }
        .ok  { display: flex; align-items: center;     gap: 8px; background: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 9px; padding: 10px 14px; color: #15803d; font-size: .8rem; font-weight: 500; margin-top: 10px; }

        /* Spinner */
        .spin { animation: sp 1s linear infinite; }
        @keyframes sp { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        /* Misc */
        .empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3rem 1rem; gap: 12px; text-align: center; }
        @media (max-width: 1100px) { .layout { flex-direction: column !important; } .rhs { width: 100% !important; } }
        @media (max-width: 620px)  { .tgrid { grid-template-columns: 1fr !important; } }
        @media print { .noprint { display: none !important; } }
      `}</style>

      <div className="ab-root">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="noprint" style={{ background: "#fff", borderBottom: "1.5px solid #e8ddd5", padding: "1rem 1.75rem", boxShadow: "0 2px 8px rgba(107,15,42,.06)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 className="serif" style={{ fontSize: "1.8rem", fontWeight: 700, color: "#6B0F2A", margin: 0, lineHeight: 1 }}>Point of Sale</h1>
            <p style={{ fontSize: ".75rem", color: "#9E6070", margin: "4px 0 0" }}>
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 6, background: "#fdf8f4", border: "1.5px solid #e8ddd5", borderRadius: 10, padding: "4px 6px" }}>
              <Pill label="Intrastate (CGST+SGST)" active={gstMode === "intrastate"} onClick={() => toggleGSTMode("intrastate")} />
              <Pill label="Interstate (IGST)"       active={gstMode === "interstate"} onClick={() => toggleGSTMode("interstate")} />
            </div>
            {cart.length > 0 && (
              <button className="btn btn-s" onClick={clearCart}>
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                Clear Cart
              </button>
            )}
          </div>
        </div>

        {/* ── Main layout ─────────────────────────────────────── */}
        <div className="layout" style={{ display: "flex", gap: "1.25rem", padding: "1.25rem 1.75rem", alignItems: "flex-start" }}>

          {/* LEFT */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "1.25rem" }}>

            {/* Customer + Scan */}
            <div className="tgrid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>

              {/* Customer */}
              <Card>
                <CardHeader icon={icn("M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z")} title="Customer" />
                <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label className="lbl">Name (optional)</label>
                    <input className="inp" placeholder="Walk-in Customer" value={customerName} onChange={e => setCustomerName(e.target.value)} />
                  </div>
                  <div>
                    <label className="lbl">Phone (optional)</label>
                    <input className="inp" type="tel" placeholder="+91 98765 43210" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} maxLength={15} />
                  </div>
                </div>
              </Card>

              {/* Scan */}
              <Card>
                <CardHeader icon={icn("M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z")} title="Scan / Enter Stock ID" />
                <div style={{ padding: "16px 18px" }}>
                  <label className="lbl">Stock ID or Barcode</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ flex: 1, position: "relative" }}>
                      <input
                        ref={scanRef}
                        className="inp"
                        style={{ paddingRight: scanLoading ? "2.5rem" : ".875rem" }}
                        placeholder="Scan or type Stock ID, then Enter…"
                        value={stockInput}
                        onChange={e => { setStockInput(e.target.value); if (scanError) setScanError(null); }}
                        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); fetchProduct(stockInput); } }}
                        autoComplete="off"
                        spellCheck={false}
                      />
                      {scanLoading && <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)" }}><Spinner size={14} /></span>}
                    </div>
                    <button className="btn btn-p"
                      style={{ padding: ".62rem 1rem", flexShrink: 0 }}
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => fetchProduct(stockInput)}
                      disabled={scanLoading || !stockInput.trim()}
                    >Add</button>
                  </div>

                  {scanError && (
                    <div className="err">
                      <svg width="14" height="14" fill="currentColor" viewBox="0 0 20 20" style={{ flexShrink: 0, marginTop: 1 }}>
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                      </svg>
                      {scanError}
                    </div>
                  )}

                  {!scanError && lastScanned && cart.length > 0 && (
                    <div className="ok">
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
                      <span>
                        <strong>{lastScanned.productName}</strong>
                        {" "}&mdash; {lastScanned.size} / {lastScanned.color} @ ₹{fmt(lastScanned.price)}
                        <span style={{ color: "#9E6070", marginLeft: 6, fontSize: ".72rem" }}>({lastScanned.stockId})</span>
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Cart */}
            <Card>
              <CardHeader
                icon={icn("M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z")}
                title="Cart"
                right={cart.length > 0 && (
                  <span style={{ background: "#6B0F2A", color: "#F5F0E6", fontSize: ".68rem", fontWeight: 700, borderRadius: 999, padding: "2px 9px" }}>
                    {cart.reduce((s, i) => s + i.quantity, 0)} item{cart.reduce((s,i)=>s+i.quantity,0)!==1?"s":""}
                  </span>
                )}
              />
              <div style={{ overflowX: "auto" }}>
                {cart.length === 0 ? (
                  <div className="empty">
                    <svg width="44" height="44" fill="none" stroke="#ddd0c8" strokeWidth={1.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" /></svg>
                    <p style={{ fontSize: ".875rem", fontWeight: 600, color: "#9E6070", margin: 0 }}>Cart is empty</p>
                    <p style={{ fontSize: ".78rem", color: "#b89aa6", margin: 0 }}>Scan a barcode or type a Stock ID above to begin</p>
                  </div>
                ) : (
                  <table className="ct">
                    <thead>
                      <tr>
                        {(["Stock ID","Product","Size","Color","HSN","Price","GST%","Qty","GST Amt","Total",""] as const).map(h => (
                          <th key={h} style={{ textAlign: ["Price","GST Amt","Total"].includes(h) ? "right" : h==="Qty" ? "center" : "left" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cart.map(item => (
                        <tr key={item.cartId}>
                          <td style={{ fontFamily: "monospace", fontSize: ".73rem", color: "#9E6070" }}>{item.stockId}</td>
                          <td style={{ fontWeight: 600, color: "#3b1c25", whiteSpace: "nowrap" }}>{item.productName}</td>
                          <td style={{ color: "#9E6070" }}>{item.size}</td>
                          <td style={{ color: "#9E6070" }}>{item.color}</td>
                          <td style={{ color: "#9E6070", fontSize: ".73rem" }}>{item.hsnCode}</td>
                          <td style={{ textAlign: "right" }}>₹{fmt(item.price)}</td>
                          <td style={{ textAlign: "center" }}>
                            <span style={{ background: "#fdf0f5", color: "#A84C6B", borderRadius: 999, padding: "2px 8px", fontSize: ".7rem", fontWeight: 700 }}>
                              {item.gstPercent}%
                            </span>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "center" }}>
                              <QtyBtn onClick={() => bumpQty(item.cartId, -1)}>−</QtyBtn>
                              <input
                                style={{ width: 36, textAlign: "center", border: "1.5px solid #ddd0c8", borderRadius: 6, padding: "2px 4px", fontSize: ".82rem", fontFamily: "inherit", outline: "none", color: "#3b1c25" }}
                                value={item.quantity}
                                onChange={e => setQty(item.cartId, parseInt(e.target.value) || 0)}
                                onFocus={e => e.currentTarget.select()}
                              />
                              <QtyBtn onClick={() => bumpQty(item.cartId, 1)}>+</QtyBtn>
                            </div>
                          </td>
                          <td style={{ textAlign: "right", fontSize: ".75rem", color: "#9E6070" }}>
                            {gstMode === "intrastate"
                              ? `₹${fmt(item.cgst)}+₹${fmt(item.sgst)}`
                              : `₹${fmt(item.igst)}`}
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 700, color: "#6B0F2A" }}>₹{fmt(item.lineTotal)}</td>
                          <td>
                            <IconBtn danger onClick={() => removeItem(item.cartId)} title="Remove">
                              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                            </IconBtn>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={7} style={{ color: "#9E6070" }}>Totals</td>
                        <td style={{ textAlign: "center" }}>{cart.reduce((s,i) => s+i.quantity, 0)}</td>
                        <td style={{ textAlign: "right", color: "#A84C6B" }}>₹{fmt(gstTotal)}</td>
                        <td style={{ textAlign: "right", color: "#6B0F2A", fontSize: ".88rem" }}>₹{fmt(subtotal + gstTotal)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </Card>
          </div>

          {/* RHS */}
          <div className="rhs" style={{ width: 310, flexShrink: 0, display: "flex", flexDirection: "column", gap: "1.25rem" }}>

            {/* Summary */}
            <Card>
              <CardHeader icon={icn("M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4.75 21h14.5A2.25 2.25 0 0021.5 18.75V5.25A2.25 2.25 0 0019.25 3H4.75A2.25 2.25 0 002.5 5.25v13.5A2.25 2.25 0 004.75 21z")} title="Bill Summary" />
              <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 2 }}>
                <SumRow label="Subtotal"  value={`₹${fmt(subtotal)}`} />
                {gstMode === "intrastate"
                  ? <><SumRow label="CGST" value={`₹${fmt(cgstTotal)}`} muted /><SumRow label="SGST" value={`₹${fmt(sgstTotal)}`} muted /></>
                  : <SumRow label="IGST" value={`₹${fmt(igstTotal)}`} muted />}
                <SumRow label="GST Total" value={`₹${fmt(gstTotal)}`} bold />

                <div style={{ padding: "8px 0", borderTop: "1px dotted #e8ddd5" }}>
                  <label className="lbl">Discount (₹)</label>
                  <input className="inp" style={{ marginTop: 4 }} placeholder="0.00" value={discount} onChange={e => setDiscount(e.target.value.replace(/[^0-9.]/g, ""))} />
                </div>
                {discountAmt > 0 && <SumRow label="Discount" value={`−₹${fmt(discountAmt)}`} green />}
                <SumRow label="Grand Total" value={`₹${fmt(grandTotal)}`} highlight />

                {cart.length > 0 && (
                  <p style={{ fontSize: ".7rem", color: "#9E6070", fontStyle: "italic", marginTop: 8, lineHeight: 1.5 }}>
                    {inWords(grandTotal)}
                  </p>
                )}
              </div>
            </Card>

            {/* Payment */}
            <Card>
              <CardHeader icon={icn("M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z")} title="Payment" />
              <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label className="lbl" style={{ marginBottom: 8 }}>Method</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {(["cash","upi","card"] as PaymentMethod[]).map(m => (
                      <div key={m} className={`pm ${paymentMethod===m?"on":""}`} onClick={() => setPaymentMethod(m)}>
                        <div style={{ fontSize: "1.3rem", marginBottom: 3 }}>{m==="cash"?"💵":m==="upi"?"📱":"💳"}</div>
                        <div style={{ fontSize: ".68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: paymentMethod===m ? "#6B0F2A" : "#9E6070" }}>{m}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="lbl">Received Amount (₹)</label>
                  <div style={{ position: "relative", marginTop: 4 }}>
                    <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#9E6070", fontWeight: 600 }}>₹</span>
                    <input className="inp" style={{ paddingLeft: "1.75rem" }} placeholder="0.00" value={receivedAmount} onChange={e => setReceivedAmount(e.target.value.replace(/[^0-9.]/g,""))} />
                  </div>
                </div>

                {received > 0 && (
                  <div style={{ borderRadius: 9, padding: "10px 14px", background: balance>=0 ? "#f0fdf4" : "#fef2f2", border: `1.5px solid ${balance>=0 ? "#bbf7d0" : "#fecaca"}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: ".8rem", fontWeight: 600, color: balance>=0 ? "#15803d" : "#b91c1c" }}>
                        {balance >= 0 ? "Change to Return" : "Balance Due"}
                      </span>
                      <span style={{ fontSize: ".9rem", fontWeight: 800, color: balance>=0 ? "#15803d" : "#b91c1c" }}>
                        ₹{fmt(Math.abs(balance))}
                      </span>
                    </div>
                  </div>
                )}

                <button className="btn btn-p"
                  style={{ width: "100%", justifyContent: "center", padding: ".8rem", fontSize: ".9rem", borderRadius: 11, marginTop: 2 }}
                  onClick={handleGenerate}
                  disabled={cart.length === 0 || saveMutation.isPending}
                >
                  {saveMutation.isPending ? (
                    <><Spinner size={15} ivory />Saving…</>
                  ) : (
                    <>
                      <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                      Generate Bill
                    </>
                  )}
                </button>
              </div>
            </Card>
          </div>
        </div>

        {/* ── Invoice Modal ─────────────────────────────────── */}
        {showInvoice && invoiceData && (
          <div className="mb noprint">
            <div className="mbox">
              <div style={{ padding: "1rem 1.5rem", borderBottom: "1.5px solid #f0e8e4", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <h2 className="serif" style={{ fontSize: "1.4rem", fontWeight: 700, color: "#6B0F2A", margin: 0 }}>Invoice Generated</h2>
                  <p style={{ fontSize: ".75rem", color: "#9E6070", margin: "3px 0 0" }}>{invoiceData.invoiceNo} · {invoiceData.date}</p>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn btn-p" onClick={() => handlePrint()}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" /></svg>
                    Print Invoice
                  </button>
                  <button className="btn btn-s" onClick={handleNewBill}>
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                    New Bill
                  </button>
                </div>
              </div>
              <div style={{ padding: "1.25rem", maxHeight: "75vh", overflowY: "auto" }}>
                <div ref={printRef}>
                  <InvoicePrint data={invoiceData} />
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}