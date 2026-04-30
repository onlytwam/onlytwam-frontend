import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useReactToPrint } from "react-to-print";
import api from "@/shared/api/axiosInstance";
import toast from "react-hot-toast";
import type { Product, CartItem, PaymentMethod, GSTMode, BillingState, } from "../utils/billingUtils";
import { calcGST, toCartItem, recalcItem, fmt, inWords, genInvoiceNo, } from "../utils/billingUtils";


interface InvoicePrintProps {
  invoiceNo: string;
  date: string;
  customerName: string;
  customerPhone: string;
  storeName: string;
  storeAddress: string;
  storeGSTIN: string;
  cart: CartItem[];
  subtotal: number;
  gstTotal: number;
  discount: number;
  grandTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  gstMode: GSTMode;
  paymentMethod: PaymentMethod;
  receivedAmount: number;
  balance: number;
}

const InvoicePrint = (props: InvoicePrintProps) => {
  const { invoiceNo, date, customerName } = props;

  return (
    <div>
      <h2>Invoice #{invoiceNo}</h2>
      <p>Date: {date}</p>
      <p>Customer: {customerName}</p>
    </div>
  );
};



// ─── Store config (update to match your settings API or constants) ────────────
const STORE_CONFIG = {
    name: "TWAM",
    address: "123 Fashion Street, Hyderabad, Telangana - 500001",
    gstin: "36AABCT1234A1Z5",
    state: "Telangana",
};

// ─── Small reusable UI atoms ─────────────────────────────────────────────────

function Pill({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                padding: "0.45rem 1.1rem",
                borderRadius: 999,
                border: active ? "none" : "1.5px solid #ddd0c8",
                background: active ? "#6B0F2A" : "transparent",
                color: active ? "#F5F0E6" : "#9E6070",
                fontWeight: 600,
                fontSize: "0.8rem",
                cursor: "pointer",
                transition: "all 0.15s",
                fontFamily: "inherit",
                letterSpacing: "0.02em",
            }}
        >
            {children}
        </button>
    );
}

function QtyButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                width: 26, height: 26, borderRadius: 6,
                border: "1.5px solid #ddd0c8", background: "#fdf8f4",
                color: "#6B0F2A", fontWeight: 800, fontSize: 14,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                lineHeight: 1, fontFamily: "inherit", transition: "background 0.12s",
            }}
            onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.background = "#f0e0e7"; }}
            onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.background = "#fdf8f4"; }}
        >
            {children}
        </button>
    );
}

function SummaryRow({ label, value, highlight, muted, green }: { label: string; value: string; highlight?: boolean; muted?: boolean; green?: boolean }) {
    return (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: highlight ? "10px 14px" : "6px 0", background: highlight ? "#6B0F2A" : "transparent", borderRadius: highlight ? 8 : 0, borderTop: !highlight ? "1px dotted #e8ddd5" : "none", marginTop: !highlight ? 0 : 6 }}>
            <span style={{ fontSize: highlight ? "0.95rem" : "0.82rem", fontWeight: highlight ? 700 : 500, color: highlight ? "#F5F0E6" : muted ? "#9E6070" : "#3b1c25" }}>{label}</span>
            <span style={{ fontSize: highlight ? "1rem" : "0.82rem", fontWeight: highlight ? 800 : 600, color: highlight ? "#F5F0E6" : green ? "#16a34a" : "#3b1c25" }}>{value}</span>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminBilling() {
    // ── State ────────────────────────────────────────────────────
    const [stockInput, setStockInput] = useState("");
    const [scanError, setScanError] = useState<string | null>(null);
    const [scanLoading, setScanLoading] = useState(false);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [discount, setDiscount] = useState<string>("");
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
    const [receivedAmount, setReceivedAmount] = useState<string>("");
    const [gstMode, setGstMode] = useState<GSTMode>("intrastate");
    const [customerName, setCustomerName] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [invoiceNo] = useState(() => genInvoiceNo());
    const [invoiceDate] = useState(() => new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }));
    const [showInvoice, setShowInvoice] = useState(false);
    const [lastScanned, setLastScanned] = useState<Product | null>(null);

    const qc = useQueryClient();
    const scanInputRef = useRef<HTMLInputElement>(null);
    const printRef = useRef<HTMLDivElement>(null);

    // Auto-focus scan input on mount
    useEffect(() => { scanInputRef.current?.focus(); }, []);

    // ── Product lookup ───────────────────────────────────────────
    const fetchProduct = useCallback(async (stockId: string) => {
        if (!stockId.trim()) return;
        setScanLoading(true);
        setScanError(null);
        try {
            const res = await api.get<Product>(`/api/product/${stockId.trim()}`);
            const product = res.data;
            setLastScanned(product);
            setCart((prev) => {
                const existing = prev.find((i) => i.stockId === product.stockId);
                if (existing) {
                    return prev.map((i) =>
                        i.stockId === product.stockId
                            ? recalcItem({ ...i, quantity: i.quantity + 1 }, gstMode)
                            : i
                    );
                }
                return [...prev, toCartItem(product, gstMode)];
            });
            toast.success(`Added: ${product.productName}`);
            setStockInput("");
        } catch (err: any) {
            const msg = err?.response?.data?.detail || err?.response?.data?.message || "Product not found. Check the stock number and try again.";
            setScanError(msg);
            toast.error(msg);
        } finally {
            setScanLoading(false);
            setTimeout(() => scanInputRef.current?.focus(), 50);
        }
    }, [gstMode]);

    const handleScanKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") fetchProduct(stockInput);
    };

    // ── GST mode change — recalc all items ───────────────────────
    const handleGstModeChange = (mode: GSTMode) => {
        setGstMode(mode);
        setCart((prev) => prev.map((i) => recalcItem(i, mode)));
    };

    // ── Cart mutations ────────────────────────────────────────────
    const updateQty = (cartId: string, delta: number) => {
        setCart((prev) =>
            prev
                .map((i) => i.cartId === cartId ? recalcItem({ ...i, quantity: i.quantity + delta }, gstMode) : i)
                .filter((i) => i.quantity > 0)
        );
    };
    const setQty = (cartId: string, val: number) => {
        if (isNaN(val) || val < 0) return;
        setCart((prev) =>
            val === 0
                ? prev.filter((i) => i.cartId !== cartId)
                : prev.map((i) => i.cartId === cartId ? recalcItem({ ...i, quantity: val }, gstMode) : i)
        );
    };
    const removeItem = (cartId: string) => setCart((prev) => prev.filter((i) => i.cartId !== cartId));
    const clearCart = () => { setCart([]); setLastScanned(null); setScanError(null); };

    // ── Totals ─────────────────────────────────────────────────────
    const subtotal = cart.reduce((s, i) => s + i.subtotal, 0);
    const cgstTotal = cart.reduce((s, i) => s + i.cgst, 0);
    const sgstTotal = cart.reduce((s, i) => s + i.sgst, 0);
    const igstTotal = cart.reduce((s, i) => s + i.igst, 0);
    const gstTotal = cart.reduce((s, i) => s + i.gstAmount, 0);
    const discountAmt = parseFloat(discount) || 0;
    const grandTotal = subtotal + gstTotal - discountAmt;
    const received = parseFloat(receivedAmount) || 0;
    const balance = received - grandTotal;

    // ── Save order mutation ────────────────────────────────────────
    const saveMutation = useMutation({
        mutationFn: () => api.post("/api/orders", {
            invoiceNo,
            invoiceDate,
            customerName,
            customerPhone,
            gstMode,
            paymentMethod,
            items: cart,
            subtotal,
            gstTotal,
            cgstTotal,
            sgstTotal,
            igstTotal,
            discount: discountAmt,
            grandTotal,
            receivedAmount: received,
            balance,
        }),
        onSuccess: () => {
            toast.success("Order saved successfully!");
            setShowInvoice(true);
        },
        onError: (e: any) => toast.error(e?.response?.data?.detail || "Failed to save order. Please try again."),
    });

    const handleGenerateBill = () => {
        if (cart.length === 0) { toast.error("Cart is empty. Please add items first."); return; }
        saveMutation.mutate();
    };

    // ── Print ──────────────────────────────────────────────────────
const handlePrint = useReactToPrint({contentRef: printRef,});
    // ── New Bill ───────────────────────────────────────────────────
    const handleNewBill = () => {
        clearCart();
        setCustomerName("");
        setCustomerPhone("");
        setDiscount("");
        setReceivedAmount("");
        setPaymentMethod("cash");
        setShowInvoice(false);
    };

    // ─── RENDER ───────────────────────────────────────────────────
    return (
        <>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Sans:wght@300;400;500;600&display=swap');
        .pos-root * { box-sizing: border-box; }
        .pos-root { font-family: 'DM Sans', sans-serif; background: #F5F0E6; min-height: 100vh; color: #3b1c25; }
        .pos-input { width: 100%; border: 1.5px solid #ddd0c8; border-radius: 9px; background: #fff; padding: 0.65rem 0.9rem; font-size: 0.875rem; color: #3b1c25; font-family: inherit; outline: none; transition: border-color 0.15s, box-shadow 0.15s; box-shadow: 0 1px 3px rgba(107,15,42,0.05); }
        .pos-input::placeholder { color: #b89aa6; }
        .pos-input:focus { border-color: #6B0F2A; box-shadow: 0 0 0 3px rgba(107,15,42,0.10); }
        .pos-input:read-only { background: #faf6f2; color: #8a6070; cursor: default; }
        .pos-label { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #9E6070; display: block; margin-bottom: 5px; }
        .pos-card { background: #fff; border: 1.5px solid #e8ddd5; border-radius: 14px; }
        .pos-card-header { padding: 14px 18px; border-bottom: 1.5px solid #f0e8e4; display: flex; align-items: center; gap: 10px; }
        .pos-card-body { padding: 16px 18px; }
        .pos-serif { font-family: 'Cormorant Garamond', Georgia, serif; }
        .cart-table { width: 100%; border-collapse: collapse; }
        .cart-table thead tr { background: #6B0F2A; }
        .cart-table thead th { padding: 9px 10px; color: #F5F0E6; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; white-space: nowrap; }
        .cart-table thead th:first-child { border-radius: 8px 0 0 0; }
        .cart-table thead th:last-child { border-radius: 0 8px 0 0; }
        .cart-table tbody tr { border-bottom: 1px solid #f0e8e4; transition: background 0.12s; }
        .cart-table tbody tr:hover { background: #fdf8f4; }
        .cart-table tbody td { padding: 9px 10px; font-size: 0.8rem; vertical-align: middle; }
        .cart-table tfoot tr { border-top: 2px solid #e8ddd5; background: #fdf8f4; }
        .cart-table tfoot td { padding: 9px 10px; font-weight: 700; font-size: 0.82rem; }
        .btn-primary { display: inline-flex; align-items: center; gap: 7px; background: #6B0F2A; color: #F5F0E6; font-family: 'DM Sans', sans-serif; font-weight: 600; font-size: 0.875rem; border: none; border-radius: 10px; padding: 0.7rem 1.5rem; cursor: pointer; box-shadow: 0 2px 10px rgba(107,15,42,0.28); transition: background 0.15s, box-shadow 0.15s, transform 0.1s; }
        .btn-primary:hover { background: #8a1235; box-shadow: 0 4px 16px rgba(107,15,42,0.36); transform: translateY(-1px); }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .btn-secondary { display: inline-flex; align-items: center; gap: 6px; background: transparent; color: #6B0F2A; font-family: 'DM Sans', sans-serif; font-weight: 600; font-size: 0.8rem; border: 1.5px solid #ddd0c8; border-radius: 9px; padding: 0.575rem 1.1rem; cursor: pointer; transition: all 0.15s; }
        .btn-secondary:hover { border-color: #9E6070; background: #fdf4f7; }
        .btn-danger { background: transparent; border: none; cursor: pointer; color: #c97070; padding: 4px; border-radius: 6px; transition: background 0.12s, color 0.12s; display: flex; align-items: center; }
        .btn-danger:hover { background: #fef2f2; color: #dc2626; }
        .scan-error { display: flex; align-items: center; gap: 8px; background: #fef2f2; border: 1.5px solid #fecaca; border-radius: 9px; padding: 10px 14px; color: #b91c1c; font-size: 0.8rem; font-weight: 500; margin-top: 10px; }
        .scan-success-badge { display: flex; align-items: center; gap: 8px; background: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 9px; padding: 10px 14px; color: #15803d; font-size: 0.8rem; font-weight: 500; margin-top: 10px; }
        .empty-cart { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3rem 1rem; gap: 12px; text-align: center; }
        .payment-card { border: 2px solid transparent; border-radius: 10px; padding: 12px; cursor: pointer; transition: all 0.15s; background: #fdf8f4; text-align: center; flex: 1; }
        .payment-card.active { border-color: #6B0F2A; background: #f0e0e7; }
        .payment-card:hover:not(.active) { border-color: #ddd0c8; background: #fff; }
        .modal-backdrop { position: fixed; inset: 0; z-index: 100; background: rgba(59,28,37,0.55); backdrop-filter: blur(6px); display: flex; align-items: flex-start; justify-content: center; padding: 2rem 1rem; overflow-y: auto; }
        .modal-box { background: #fff; border-radius: 18px; width: 100%; max-width: 760px; box-shadow: 0 30px 80px rgba(107,15,42,0.28); border: 1.5px solid #e8ddd5; animation: modalIn 0.22s cubic-bezier(0.34,1.56,0.64,1); }
        @keyframes modalIn { from { opacity: 0; transform: scale(0.95) translateY(16px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .section-heading { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #9E6070; display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
        .section-heading::after { content: ''; flex: 1; height: 1px; background: linear-gradient(to right, #e8ddd5, transparent); }
        @media (max-width: 1100px) { .pos-layout { flex-direction: column !important; } .pos-right { width: 100% !important; } }
        @media print { .no-print { display: none !important; } }
      `}</style>

            <div className="pos-root">

                {/* ── Page Header ── */}
                <div className="no-print" style={{ background: "#fff", borderBottom: "1.5px solid #e8ddd5", padding: "1rem 1.75rem", boxShadow: "0 2px 8px rgba(107,15,42,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                    <div>
                        <h1 className="pos-serif" style={{ fontSize: "1.75rem", fontWeight: 700, color: "#6B0F2A", margin: 0, lineHeight: 1 }}>Point of Sale</h1>
                        <p style={{ fontSize: "0.78rem", color: "#9E6070", margin: "4px 0 0" }}>{invoiceNo} &nbsp;·&nbsp; {invoiceDate}</p>
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                            <Pill active={gstMode === "intrastate"} onClick={() => handleGstModeChange("intrastate")}>Intrastate (CGST+SGST)</Pill>
                            <Pill active={gstMode === "interstate"} onClick={() => handleGstModeChange("interstate")}>Interstate (IGST)</Pill>
                        </div>
                        {cart.length > 0 && (
                            <button className="btn-secondary" onClick={clearCart}>
                                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Clear Cart
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Main Layout ── */}
                <div className="pos-layout" style={{ display: "flex", gap: "1.25rem", padding: "1.25rem 1.75rem", alignItems: "flex-start" }}>

                    {/* ─── LEFT: Scan + Cart ─── */}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1.25rem", minWidth: 0 }}>

                        {/* Customer + Scan row */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>

                            {/* Customer info */}
                            <div className="pos-card">
                                <div className="pos-card-header">
                                    <svg width="16" height="16" fill="none" stroke="#6B0F2A" strokeWidth={2} viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                    </svg>
                                    <span className="pos-serif" style={{ fontSize: "1rem", fontWeight: 700, color: "#6B0F2A" }}>Customer</span>
                                </div>
                                <div className="pos-card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                    <div>
                                        <label className="pos-label">Name (optional)</label>
                                        <input className="pos-input" placeholder="Walk-in Customer" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="pos-label">Phone (optional)</label>
                                        <input className="pos-input" placeholder="+91 98765 43210" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} maxLength={15} />
                                    </div>
                                </div>
                            </div>

                            {/* Stock scan */}
                            <div className="pos-card">
                                <div className="pos-card-header">
                                    <svg width="16" height="16" fill="none" stroke="#6B0F2A" strokeWidth={2} viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75V16.5zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75V13.5zM13.5 19.5h.75v.75h-.75V19.5zM19.5 13.5h.75v.75h-.75V13.5zM19.5 19.5h.75v.75h-.75V19.5zM16.5 16.5h.75v.75h-.75V16.5z" />
                                    </svg>
                                    <span className="pos-serif" style={{ fontSize: "1rem", fontWeight: 700, color: "#6B0F2A" }}>Scan / Enter Stock No.</span>
                                </div>
                                <div className="pos-card-body">
                                    <label className="pos-label">Stock Number or Barcode</label>
                                    <div style={{ display: "flex", gap: 8 }}>
                                        <div style={{ flex: 1, position: "relative" }}>
                                            <input
                                                ref={scanInputRef}
                                                className="pos-input"
                                                style={{ paddingRight: scanLoading ? "2.5rem" : "0.9rem" }}
                                                placeholder="Scan barcode or type stock no. + Enter"
                                                value={stockInput}
                                                onChange={(e) => { setStockInput(e.target.value); setScanError(null); }}
                                                onKeyDown={handleScanKeyDown}
                                                autoComplete="off"
                                                autoFocus
                                            />
                                            {scanLoading && (
                                                <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)" }}>
                                                    <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ color: "#6B0F2A" }}>
                                                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity: 0.25 }} />
                                                        <path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" style={{ opacity: 0.75 }} />
                                                    </svg>
                                                </span>
                                            )}
                                        </div>
                                        <button
                                            className="btn-primary"
                                            style={{ padding: "0.65rem 1rem", flexShrink: 0 }}
                                            onClick={() => fetchProduct(stockInput)}
                                            disabled={scanLoading || !stockInput.trim()}
                                        >
                                            Add
                                        </button>
                                    </div>

                                    {scanError && (
                                        <div className="scan-error">
                                            <svg width="15" height="15" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                            {scanError}
                                        </div>
                                    )}

                                    {!scanError && lastScanned && cart.length > 0 && (
                                        <div className="scan-success-badge">
                                            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                            </svg>
                                            <span><strong>{lastScanned.productName}</strong> — {lastScanned.size} / {lastScanned.color} @ ₹{fmt(lastScanned.price)} added</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* ── Cart ── */}
                        <div className="pos-card">
                            <div className="pos-card-header" style={{ justifyContent: "space-between" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <svg width="16" height="16" fill="none" stroke="#6B0F2A" strokeWidth={2} viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                                    </svg>
                                    <span className="pos-serif" style={{ fontSize: "1rem", fontWeight: 700, color: "#6B0F2A" }}>Cart</span>
                                    {cart.length > 0 && (
                                        <span style={{ background: "#6B0F2A", color: "#F5F0E6", fontSize: "0.7rem", fontWeight: 700, borderRadius: 999, padding: "1px 8px" }}>
                                            {cart.reduce((s, i) => s + i.quantity, 0)} items
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div style={{ overflowX: "auto" }}>
                                {cart.length === 0 ? (
                                    <div className="empty-cart">
                                        <svg width="44" height="44" fill="none" stroke="#ddd0c8" strokeWidth={1.2} viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                                        </svg>
                                        <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "#9E6070", margin: 0 }}>Cart is empty</p>
                                        <p style={{ fontSize: "0.78rem", color: "#b89aa6", margin: 0 }}>Scan a barcode or enter a stock number above</p>
                                    </div>
                                ) : (
                                    <table className="cart-table">
                                        <thead>
                                            <tr>
                                                {["Product", "Size", "Color", "HSN", "Price", "GST%", "Qty", "GST Amt", "Total", ""].map((h) => (
                                                    <th key={h} style={{ textAlign: h === "Price" || h === "GST Amt" || h === "Total" ? "right" : h === "Qty" ? "center" : "left" }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {cart.map((item) => (
                                                <tr key={item.cartId}>
                                                    <td style={{ fontWeight: 600, color: "#3b1c25", whiteSpace: "nowrap" }}>{item.productName}</td>
                                                    <td style={{ color: "#9E6070" }}>{item.size}</td>
                                                    <td style={{ color: "#9E6070" }}>{item.color}</td>
                                                    <td style={{ color: "#9E6070", fontSize: "0.75rem" }}>{item.hsnCode}</td>
                                                    <td style={{ textAlign: "right" }}>₹{fmt(item.price)}</td>
                                                    <td style={{ textAlign: "center" }}>
                                                        <span style={{ background: "#fdf0f5", color: "#A84C6B", borderRadius: 999, padding: "2px 8px", fontSize: "0.72rem", fontWeight: 700 }}>
                                                            {item.gstPercent}%
                                                        </span>
                                                    </td>
                                                    <td style={{ textAlign: "center" }}>
                                                        <div style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "center" }}>
                                                            <QtyButton onClick={() => updateQty(item.cartId, -1)}>−</QtyButton>
                                                            <input
                                                                style={{ width: 36, textAlign: "center", border: "1.5px solid #ddd0c8", borderRadius: 6, padding: "2px 4px", fontSize: "0.82rem", fontFamily: "inherit", outline: "none", color: "#3b1c25" }}
                                                                value={item.quantity}
                                                                onChange={(e) => setQty(item.cartId, parseInt(e.target.value) || 0)}
                                                                onFocus={(e) => e.currentTarget.select()}
                                                            />
                                                            <QtyButton onClick={() => updateQty(item.cartId, 1)}>+</QtyButton>
                                                        </div>
                                                    </td>
                                                    <td style={{ textAlign: "right", fontSize: "0.77rem", color: "#9E6070" }}>
                                                        {gstMode === "intrastate"
                                                            ? `₹${fmt(item.cgst)}+₹${fmt(item.sgst)}`
                                                            : `₹${fmt(item.igst)}`}
                                                    </td>
                                                    <td style={{ textAlign: "right", fontWeight: 700, color: "#6B0F2A" }}>₹{fmt(item.lineTotal)}</td>
                                                    <td>
                                                        <button className="btn-danger" onClick={() => removeItem(item.cartId)} title="Remove item">
                                                            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                                            </svg>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr>
                                                <td colSpan={6} style={{ color: "#9E6070", fontWeight: 600 }}>Totals</td>
                                                <td style={{ textAlign: "center" }}>{cart.reduce((s, i) => s + i.quantity, 0)}</td>
                                                <td style={{ textAlign: "right", color: "#A84C6B" }}>₹{fmt(gstTotal)}</td>
                                                <td style={{ textAlign: "right", color: "#6B0F2A", fontSize: "0.9rem" }}>₹{fmt(subtotal + gstTotal)}</td>
                                                <td />
                                            </tr>
                                        </tfoot>
                                    </table>
                                )}
                            </div>
                        </div>

                    </div>

                    {/* ─── RIGHT: Summary + Payment ─── */}
                    <div className="pos-right" style={{ width: 320, flexShrink: 0, display: "flex", flexDirection: "column", gap: "1.25rem" }}>

                        {/* Summary */}
                        <div className="pos-card">
                            <div className="pos-card-header">
                                <svg width="16" height="16" fill="none" stroke="#6B0F2A" strokeWidth={2} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4.75 21h14.5A2.25 2.25 0 0021.5 18.75V5.25A2.25 2.25 0 0019.25 3H4.75A2.25 2.25 0 002.5 5.25v13.5A2.25 2.25 0 004.75 21z" />
                                </svg>
                                <span className="pos-serif" style={{ fontSize: "1rem", fontWeight: 700, color: "#6B0F2A" }}>Bill Summary</span>
                            </div>
                            <div className="pos-card-body" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                <SummaryRow label="Subtotal" value={`₹${fmt(subtotal)}`} />
                                {gstMode === "intrastate" ? (
                                    <>
                                        <SummaryRow label={`CGST`} value={`₹${fmt(cgstTotal)}`} muted />
                                        <SummaryRow label={`SGST`} value={`₹${fmt(sgstTotal)}`} muted />
                                    </>
                                ) : (
                                    <SummaryRow label="IGST" value={`₹${fmt(igstTotal)}`} muted />
                                )}
                                <SummaryRow label="GST Total" value={`₹${fmt(gstTotal)}`} />

                                {/* Discount */}
                                <div style={{ padding: "8px 0", borderTop: "1px dotted #e8ddd5" }}>
                                    <label className="pos-label">Discount (₹)</label>
                                    <input
                                        className="pos-input"
                                        placeholder="0.00"
                                        value={discount}
                                        onChange={(e) => setDiscount(e.target.value.replace(/[^0-9.]/g, ""))}
                                        style={{ marginTop: 4 }}
                                    />
                                </div>
                                {discountAmt > 0 && <SummaryRow label="Discount" value={`-₹${fmt(discountAmt)}`} green />}
                                <SummaryRow label="Grand Total" value={`₹${fmt(grandTotal)}`} highlight />

                                {/* Amount in words */}
                                {cart.length > 0 && (
                                    <p style={{ fontSize: "0.72rem", color: "#9E6070", fontStyle: "italic", marginTop: 8, lineHeight: 1.5 }}>
                                        {inWords(grandTotal)}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Payment */}
                        <div className="pos-card">
                            <div className="pos-card-header">
                                <svg width="16" height="16" fill="none" stroke="#6B0F2A" strokeWidth={2} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                                </svg>
                                <span className="pos-serif" style={{ fontSize: "1rem", fontWeight: 700, color: "#6B0F2A" }}>Payment</span>
                            </div>
                            <div className="pos-card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                                {/* Payment method pills */}
                                <div>
                                    <label className="pos-label" style={{ marginBottom: 8 }}>Method</label>
                                    <div style={{ display: "flex", gap: 8 }}>
                                        {(["cash", "upi", "card"] as PaymentMethod[]).map((m) => (
                                            <div
                                                key={m}
                                                className={`payment-card ${paymentMethod === m ? "active" : ""}`}
                                                onClick={() => setPaymentMethod(m)}
                                            >
                                                <div style={{ fontSize: "1.25rem", marginBottom: 4 }}>
                                                    {m === "cash" ? "💵" : m === "upi" ? "📱" : "💳"}
                                                </div>
                                                <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: paymentMethod === m ? "#6B0F2A" : "#9E6070" }}>
                                                    {m}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Received */}
                                <div>
                                    <label className="pos-label">Received Amount (₹)</label>
                                    <div style={{ position: "relative", marginTop: 4 }}>
                                        <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#9E6070", fontWeight: 600 }}>₹</span>
                                        <input
                                            className="pos-input"
                                            style={{ paddingLeft: "1.75rem" }}
                                            placeholder="0.00"
                                            value={receivedAmount}
                                            onChange={(e) => setReceivedAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                                        />
                                    </div>
                                </div>

                                {/* Balance */}
                                {received > 0 && (
                                    <div style={{ borderRadius: 10, padding: "10px 14px", background: balance >= 0 ? "#f0fdf4" : "#fef2f2", border: `1.5px solid ${balance >= 0 ? "#bbf7d0" : "#fecaca"}` }}>
                                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                                            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: balance >= 0 ? "#15803d" : "#b91c1c" }}>
                                                {balance >= 0 ? "Change to Return" : "Balance Due"}
                                            </span>
                                            <span style={{ fontSize: "0.9rem", fontWeight: 800, color: balance >= 0 ? "#15803d" : "#b91c1c" }}>
                                                ₹{fmt(Math.abs(balance))}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Generate bill */}
                                <button
                                    className="btn-primary"
                                    style={{ width: "100%", justifyContent: "center", padding: "0.8rem", fontSize: "0.95rem", borderRadius: 12, marginTop: 4 }}
                                    onClick={handleGenerateBill}
                                    disabled={cart.length === 0 || saveMutation.isPending}
                                >
                                    {saveMutation.isPending ? (
                                        <>
                                            <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity: 0.25 }} />
                                                <path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" style={{ opacity: 0.75 }} />
                                            </svg>
                                            Generating…
                                        </>
                                    ) : (
                                        <>
                                            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                            </svg>
                                            Generate Bill
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                    </div>
                </div>

                {/* ── Invoice Modal ── */}
                {showInvoice && (
                    <div className="modal-backdrop no-print">
                        <div className="modal-box">
                            {/* Modal header */}
                            <div style={{ padding: "1rem 1.5rem", borderBottom: "1.5px solid #f0e8e4", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <div>
                                    <h2 className="pos-serif" style={{ fontSize: "1.4rem", fontWeight: 700, color: "#6B0F2A", margin: 0 }}>Invoice Generated</h2>
                                    <p style={{ fontSize: "0.78rem", color: "#9E6070", margin: "3px 0 0" }}>{invoiceNo} · {invoiceDate}</p>
                                </div>
                                <div style={{ display: "flex", gap: 10 }}>
                                    <button className="btn-primary" onClick={handlePrint}>
                                        <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
                                        </svg>
                                        Print
                                    </button>
                                    <button className="btn-secondary" onClick={handleNewBill}>
                                        <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                        </svg>
                                        New Bill
                                    </button>
                                </div>
                            </div>

                            {/* Invoice preview */}
                            <div style={{ padding: "1.25rem" }}>
                                 <div ref={printRef}>
                                <InvoicePrint
                                    invoiceNo={invoiceNo}
                                    date={invoiceDate}
                                    customerName={customerName || "Walk-in Customer"}
                                    customerPhone={customerPhone}
                                    storeName={STORE_CONFIG.name}
                                    storeAddress={STORE_CONFIG.address}
                                    storeGSTIN={STORE_CONFIG.gstin}
                                    cart={cart}
                                    subtotal={subtotal}
                                    gstTotal={gstTotal}
                                    discount={discountAmt}
                                    grandTotal={grandTotal}
                                    cgstTotal={cgstTotal}
                                    sgstTotal={sgstTotal}
                                    igstTotal={igstTotal}
                                    gstMode={gstMode}
                                    paymentMethod={paymentMethod}
                                    receivedAmount={received}
                                    balance={balance}
                                />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Hidden print target (always in DOM when invoice generated) */}
                {showInvoice && (
                    <div style={{ display: "none" }}>
                        <div ref={printRef}>
                            <InvoicePrint
                                invoiceNo={invoiceNo}
                                date={invoiceDate}
                                customerName={customerName || "Walk-in Customer"}
                                customerPhone={customerPhone}
                                storeName={STORE_CONFIG.name}
                                storeAddress={STORE_CONFIG.address}
                                storeGSTIN={STORE_CONFIG.gstin}
                                cart={cart}
                                subtotal={subtotal}
                                gstTotal={gstTotal}
                                discount={discountAmt}
                                grandTotal={grandTotal}
                                cgstTotal={cgstTotal}
                                sgstTotal={sgstTotal}
                                igstTotal={igstTotal}
                                gstMode={gstMode}
                                paymentMethod={paymentMethod}
                                receivedAmount={received}
                                balance={balance}
                            />
                        </div>
                    </div>
                )}

            </div>
        </>
    );
}