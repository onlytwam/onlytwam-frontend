// =============================================================================
//  AdminBillingV2.tsx  —  TWAM POS · Multi-Channel Billing
//
//  What's new vs v1:
//    • Channel selector (POS / Amazon / Flipkart / Meesho)
//    • Warehouse picker for online channels
//    • Stock checked from Inventory table (store or warehouse)
//    • StoreId injected from auth context
//    • Cart validates qty against live stock
//
//  Brand: Burgundy #6B0F2A · Heirloom Rose #9E6070
//         Blush Pink #A84C6B · Warm Ivory #F5F0E6
// =============================================================================




import { useState, useRef, useCallback, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useReactToPrint } from "react-to-print";
import api from "@/shared/api/axiosInstance";
import toast from "react-hot-toast";
import { useAuthStore } from "@/features/auth/store/authStore";

// =============================================================================
//  ROLES
// =============================================================================

const ROLES = {
  SUPER_ADMIN:       1,
  INVENTORY_MANAGER: 3,
  STORE_MANAGER:     4,   // ← your actual role ID
} as const;

// =============================================================================
//  TYPES
// =============================================================================

type Channel = "POS" | "Amazon" | "Flipkart" | "Meesho";
type PaymentMethod = "cash" | "upi" | "card";
type GSTMode = "intrastate" | "interstate";

interface CurrentUser {
  userId:        string;
  email:         string;
  roleId:        number;
  roleName:      string;
  firstName:     string;
  storeName:     string;
  storeId:       number | null;
  warehouseId:   number | null;
  warehouseName: string;
}

interface Store {
  storeId:   number;
  storeName: string;
  address?:  string;
  phone?:    string;
  city?:     string;
  state?:    string;
  pinCode?:  string;
}

interface Warehouse {
  warehouseId:   number;
  warehouseName: string;
  address?:      string;
  contactPhone?: string;
}

interface Product {
  stockId: string;
  productName: string;
  size: string;
  color: string;
  price: number;
  mrpPrice: number;
  hsnCode: string;
  gstPercent: number;
  availableQuantity: number;
}

interface CartItem extends Product {
  cartId: string;
  quantity: number;
  subtotal: number;
  gstAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  lineTotal: number;
}


// =============================================================================
//  CHANNEL CONFIG
// =============================================================================

const CHANNELS: { id: Channel; label: string; emoji: string; online: boolean }[] = [
  { id: "POS",      label: "Store / POS",  emoji: "🏪", online: false },
  { id: "Amazon",   label: "Amazon",       emoji: "📦", online: true  },
  { id: "Flipkart", label: "Flipkart",     emoji: "🛒", online: true  },
  { id: "Meesho",   label: "Meesho",       emoji: "🛍️", online: true  },
];



const STORE = {
  name: "TWAM",
  address: "123 Fashion Street, Hyderabad, Telangana - 500001",
  phone: "+91 40 1234 5678",
  gstin: "36AABCT1234A1Z5",
};

// =============================================================================
//  PURE HELPERS
// =============================================================================

function calcLine(price: number, qty: number, gst: number, mode: GSTMode) {
  const sub  = +(price * qty).toFixed(2);
  const gstA = +((sub * gst) / 100).toFixed(2);
  const half = +(gstA / 2).toFixed(2);
  return {
    subtotal:  sub,
    gstAmount: gstA,
    cgst:  mode === "intrastate" ? half : 0,
    sgst:  mode === "intrastate" ? half : 0,
    igst:  mode === "interstate" ? gstA : 0,
    lineTotal: +(sub + gstA).toFixed(2),
  };
}

function toCartItem(p: Product, mode: GSTMode): CartItem {
  return { ...p, cartId: `${p.stockId}-${Date.now()}`, quantity: 1, ...calcLine(p.price, 1, p.gstPercent, mode) };
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
  function cvt(n: number): string {
    if (!n) return "";
    if (n < 20) return ones[n] + " ";
    if (n < 100) return tens[Math.floor(n/10)] + " " + ones[n%10] + " ";
    if (n < 1000) return ones[Math.floor(n/100)] + " Hundred " + cvt(n%100);
    if (n < 100000) return cvt(Math.floor(n/1000)) + "Thousand " + cvt(n%1000);
    if (n < 10000000) return cvt(Math.floor(n/100000)) + "Lakh " + cvt(n%100000);
    return cvt(Math.floor(n/10000000)) + "Crore " + cvt(n%10000000);
  }
  const r = Math.floor(amount), p = Math.round((amount - r) * 100);
  return (cvt(r).trim() || "Zero") + (p > 0 ? ` and ${cvt(p).trim()} Paise` : "") + " Rupees Only";
}

// =============================================================================
//  SMALL COMPONENTS
// =============================================================================

function QtyBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      style={{ width:26, height:26, borderRadius:6, border:"1.5px solid #ddd0c8", background:"#fdf8f4",
               color:"#6B0F2A", fontWeight:800, fontSize:15, cursor:"pointer",
               display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"inherit" }}>
      {children}
    </button>
  );
}

function Badge({ children, color = "#6B0F2A" }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ background: color + "18", color, border: `1px solid ${color}40`,
                   borderRadius: 999, padding: "2px 9px", fontSize: ".68rem", fontWeight: 700 }}>
      {children}
    </span>
  );
}

function SumRow({ label, value, highlight, green, muted }: {
  label: string; value: string; highlight?: boolean; green?: boolean; muted?: boolean;
}) {
  if (highlight) return (
    <div style={{ display:"flex", justifyContent:"space-between", background:"#6B0F2A",
                  borderRadius:8, padding:"10px 14px", marginTop:6 }}>
      <span style={{ fontSize:".9rem", fontWeight:700, color:"#F5F0E6" }}>{label}</span>
      <span style={{ fontSize:".95rem", fontWeight:800, color:"#F5F0E6" }}>{value}</span>
    </div>
  );
  return (
    <div style={{ display:"flex", justifyContent:"space-between", padding:"5px 0",
                  borderTop:"1px dotted #e8ddd5" }}>
      <span style={{ fontSize:".8rem", fontWeight: muted ? 400 : 500, color: muted ? "#9E6070" : "#3b1c25" }}>{label}</span>
      <span style={{ fontSize:".8rem", fontWeight: 600, color: green ? "#16a34a" : "#3b1c25" }}>{value}</span>
    </div>
  );
}

function Spinner({ size = 16, ivory = false }: { size?: number; ivory?: boolean }) {
  return (
    <svg className="spin" width={size} height={size} viewBox="0 0 24 24" fill="none"
         style={{ color: ivory ? "#F5F0E6" : "#6B0F2A" }}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity:.25 }} />
      <path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" style={{ opacity:.75 }} />
    </svg>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background:"#fff", border:"1.5px solid #e8ddd5", borderRadius:14, ...style }}>{children}</div>;
}

function CardHeader({ icon, title, right }: { icon: React.ReactNode; title: string; right?: React.ReactNode }) {
  return (
    <div style={{ padding:"13px 18px", borderBottom:"1.5px solid #f0e8e4",
                  display:"flex", alignItems:"center", justifyContent:"space-between" }}>
      <div style={{ display:"flex", alignItems:"center", gap:9 }}>
        {icon}
        <span style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:"1rem",
                       fontWeight:700, color:"#6B0F2A" }}>{title}</span>
      </div>
      {right}
    </div>
  );
}

function icn(d: string, color = "#6B0F2A") {
  return (
    <svg width="15" height="15" fill="none" stroke={color} strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

// =============================================================================
//  INVOICE PRINT
// =============================================================================

interface InvoiceData {
  invoiceNo: string; date: string; channel: Channel;
  customerName: string; customerPhone: string;
  cart: CartItem[];
  subtotal: number; cgstTotal: number; sgstTotal: number; igstTotal: number;
  gstTotal: number; discount: number; grandTotal: number;
  gstMode: GSTMode; paymentMethod: PaymentMethod;
  receivedAmount: number; balance: number;
  // Location info for dynamic address
  locationName:    string;
  locationAddress: string;
  locationPhone:   string;
  isWarehouse:     boolean;
}

// FIX: Corrected JSX structure — removed the stray </div> that was closing the
//      outer container before the items <table>, summary, and footer were rendered.
function InvoicePrint({ data }: { data: InvoiceData }) {
  const { invoiceNo, date, channel, customerName, customerPhone, cart,
          subtotal, cgstTotal, sgstTotal, igstTotal, gstTotal,
          discount, grandTotal, gstMode, paymentMethod, receivedAmount, balance,
          locationName, locationAddress, locationPhone, isWarehouse } = data;

  const CHANNEL_INFO = CHANNELS.find(c => c.id === channel);
  const GSTIN = "36AABCT1234A1Z5";

  return (
    <div style={{ fontFamily:"Arial,sans-serif", background:"#fff", color:"#1a1a1a",
                  padding:"24px 28px", maxWidth:740, margin:"0 auto", fontSize:12 }}>

      {/* Header — dynamic store/warehouse name + address */}
      <div style={{ textAlign:"center", borderBottom:"2.5px solid #6B0F2A", paddingBottom:14, marginBottom:14 }}>
        <div style={{ fontSize:22, fontWeight:800, color:"#6B0F2A", letterSpacing:1 }}>
          {locationName || "TWAM"}
        </div>
        {locationAddress && (
          <div style={{ color:"#555", fontSize:11, marginTop:3 }}>{locationAddress}</div>
        )}
        <div style={{ color:"#555", fontSize:11, marginTop:2 }}>
          {locationPhone && <>📞 {locationPhone} &nbsp;|&nbsp;</>}
          GSTIN: {GSTIN}
        </div>
      </div>

      {/* Title + channel */}
      <div style={{ textAlign:"center", marginBottom:14 }}>
        <div style={{ fontSize:14, fontWeight:700, letterSpacing:3, color:"#6B0F2A", textTransform:"uppercase" }}>
          Tax Invoice
        </div>
        <div style={{ marginTop:4, fontSize:11, color:"#9E6070" }}>
          {CHANNEL_INFO?.emoji} Channel: <strong>{channel}</strong>
          {isWarehouse && <span style={{ marginLeft:8, color:"#92400e" }}>· Warehouse Fulfilment</span>}
        </div>
      </div>

      {/* Bill To / Invoice Details */}
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:14 }}>
        <div>
          {isWarehouse ? (
            <>
              <div style={{ fontWeight:700, fontSize:10, color:"#6B0F2A", textTransform:"uppercase", letterSpacing:.5, marginBottom:4 }}>Order Info</div>
              <div style={{ fontWeight:700, fontSize:13 }}>Online Order — {channel}</div>
              <div style={{ color:"#555", fontSize:11, marginTop:2 }}>Fulfilled via {locationName}</div>
            </>
          ) : (
            <>
              <div style={{ fontWeight:700, fontSize:10, color:"#6B0F2A", textTransform:"uppercase", letterSpacing:.5, marginBottom:4 }}>Bill To</div>
              <div style={{ fontWeight:700, fontSize:13 }}>{customerName || "Walk-in Customer"}</div>
              {customerPhone && <div style={{ color:"#555", marginTop:2 }}>📞 {customerPhone}</div>}
            </>
          )}
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontWeight:700, fontSize:10, color:"#6B0F2A", textTransform:"uppercase", letterSpacing:.5, marginBottom:4 }}>Invoice Details</div>
          <div style={{ color:"#555" }}>Invoice No: <strong style={{ color:"#6B0F2A" }}>{invoiceNo}</strong></div>
          <div style={{ color:"#555", marginTop:2 }}>Date: <strong>{date}</strong></div>
        </div>
      </div>

      {/* Items table */}
      <table style={{ width:"100%", borderCollapse:"collapse", marginBottom:14 }}>
        <thead>
          <tr style={{ background:"#6B0F2A" }}>
            {["#","Stock ID","Product","Size","Color","HSN","Qty","Rate",
              gstMode === "intrastate" ? "CGST+SGST" : "IGST","Amount"].map((h,i) => (
              <th key={i} style={{ padding:"7px 8px", color:"#F5F0E6", fontSize:10, fontWeight:700,
                textAlign: (["Rate","CGST+SGST","IGST","Amount"].includes(h) ? "right" : (h === "#" || h === "Qty" ? "center" : "left")) as React.CSSProperties["textAlign"] }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cart.map((item, i) => (
            <tr key={item.cartId} style={{ background: i%2===0?"#fff":"#fdf8f4" }}>
              <td style={{ padding:"6px 8px", textAlign:"center", fontSize:11 }}>{i+1}</td>
              <td style={{ padding:"6px 8px", fontFamily:"monospace", fontSize:10, color:"#9E6070" }}>{item.stockId}</td>
              <td style={{ padding:"6px 8px", fontWeight:700, fontSize:11 }}>{item.productName}</td>
              <td style={{ padding:"6px 8px", fontSize:11 }}>{item.size}</td>
              <td style={{ padding:"6px 8px", fontSize:11 }}>{item.color}</td>
              <td style={{ padding:"6px 8px", fontSize:10, color:"#555" }}>{item.hsnCode}</td>
              <td style={{ padding:"6px 8px", textAlign:"center", fontSize:11 }}>{item.quantity}</td>
              <td style={{ padding:"6px 8px", textAlign:"right", fontSize:11 }}>₹{fmt(item.price)}</td>
              <td style={{ padding:"6px 8px", textAlign:"right", fontSize:11 }}>
                {gstMode === "intrastate"
                  ? <><div>₹{fmt(item.cgst)}</div><div style={{color:"#9E6070",fontSize:9}}>({item.gstPercent/2}%+{item.gstPercent/2}%)</div></>
                  : <><div>₹{fmt(item.igst)}</div><div style={{color:"#9E6070",fontSize:9}}>({item.gstPercent}%)</div></>}
              </td>
              <td style={{ padding:"6px 8px", textAlign:"right", fontWeight:700, fontSize:11 }}>₹{fmt(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop:"2px solid #6B0F2A" }}>
            <td colSpan={6} style={{ padding:"7px 8px", fontWeight:700, fontSize:11 }}>Total</td>
            <td style={{ padding:"7px 8px", textAlign:"center", fontWeight:700, fontSize:11 }}>
              {cart.reduce((s,i) => s+i.quantity, 0)}
            </td>
            <td style={{ padding:"7px 8px", textAlign:"right", fontWeight:700, fontSize:11 }}>₹{fmt(subtotal)}</td>
            <td style={{ padding:"7px 8px", textAlign:"right", fontWeight:700, fontSize:11 }}>₹{fmt(gstTotal)}</td>
            <td style={{ padding:"7px 8px", textAlign:"right", fontWeight:800, fontSize:12, color:"#6B0F2A" }}>
              ₹{fmt(grandTotal + discount)}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Summary */}
      <div style={{ display:"flex", justifyContent:"space-between", gap:24, marginBottom:16 }}>
        <div style={{ flex:1, background:"#fdf8f4", border:"1px solid #e8ddd5", borderRadius:8, padding:"10px 14px" }}>
          <div style={{ fontWeight:700, fontSize:9, color:"#6B0F2A", textTransform:"uppercase", marginBottom:5 }}>Amount In Words</div>
          <div style={{ fontWeight:600, fontStyle:"italic", fontSize:11, color:"#3b1c25", lineHeight:1.5 }}>{inWords(grandTotal)}</div>
          <div style={{ marginTop:10, borderTop:"1px solid #e8ddd5", paddingTop:8 }}>
            <div style={{ fontSize:10, color:"#555" }}>Payment: <strong style={{ textTransform:"capitalize" }}>{paymentMethod}</strong></div>
            {receivedAmount > 0 && <div style={{ fontSize:10, color:"#555", marginTop:2 }}>Received: <strong>₹{fmt(receivedAmount)}</strong></div>}
            {balance !== 0 && <div style={{ fontSize:10, color: balance>0?"#16a34a":"#dc2626", marginTop:2 }}>
              {balance>0 ? "Change: " : "Balance Due: "}<strong>₹{fmt(Math.abs(balance))}</strong>
            </div>}
          </div>
        </div>
        <div style={{ minWidth:210 }}>
          {([
            ["Sub Total",`₹${fmt(subtotal)}`],
            ...(gstMode==="intrastate" ? [["CGST",`₹${fmt(cgstTotal)}`],["SGST",`₹${fmt(sgstTotal)}`]] : [["IGST",`₹${fmt(igstTotal)}`]]),
            ...(discount>0 ? [["Discount",`-₹${fmt(discount)}`]] : []),
          ] as [string,string][]).map(([l,v]) => (
            <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"3px 0",
                                   borderBottom:"1px dotted #e8ddd5", fontSize:11 }}>
              <span style={{ color:"#555" }}>{l}</span>
              <span style={{ color: l==="Discount"?"#16a34a":"#1a1a1a" }}>{v}</span>
            </div>
          ))}
          <div style={{ display:"flex", justifyContent:"space-between", background:"#6B0F2A", color:"#F5F0E6",
                        borderRadius:6, padding:"8px 10px", marginTop:6, fontWeight:800, fontSize:13 }}>
            <span>Grand Total</span><span>₹{fmt(grandTotal)}</span>
          </div>
        </div>
      </div>

      <div style={{ borderTop:"1.5px solid #e8ddd5", paddingTop:10, textAlign:"center", color:"#9E6070", fontSize:10 }}>
        Thank you for shopping with us! — Computer-generated invoice, no signature required.
      </div>
    </div>
  );
}

// =============================================================================
//  MAIN COMPONENT
// =============================================================================

export default function AdminBillingV2() {
  // ── Read directly from Zustand authStore — no localStorage parsing needed ───
  const zustandUser = useAuthStore(state => state.user);
  const zustandRole = Number(localStorage.getItem("twam_role_id") || zustandUser?.roleId || 0);

  const currentUser: CurrentUser = {
    userId:        zustandUser?.userId        || (zustandUser as any)?.id   || "",
    email:         zustandUser?.email         || (zustandUser as any)?.emailId || "",
    roleId:        zustandRole,
    roleName:      (zustandUser as any)?.roleName   || "",
    firstName:     zustandUser?.firstName     || "",
    storeName:     (zustandUser as any)?.storeName  || "",
    storeId:       (zustandUser as any)?.storeId    != null ? Number((zustandUser as any).storeId)    : null,
    warehouseId:   (zustandUser as any)?.warehouseId != null ? Number((zustandUser as any).warehouseId) : null,
    warehouseName: (zustandUser as any)?.warehouseName || "",
  };

  const userRole       = currentUser.roleId;
  const isSuperAdmin   = userRole === ROLES.SUPER_ADMIN;
  const isInvManager   = userRole === ROLES.INVENTORY_MANAGER;
  const isStoreManager = userRole === ROLES.STORE_MANAGER;

// console.log("🔍 currentUser:", currentUser);
// console.log("🔍 zustandUser raw:", zustandUser);

  // ── State ──────────────────────────────────────────────────────────────────
  const [channel,        setChannel]        = useState<Channel>(
    isStoreManager ? "POS" : isInvManager ? "Amazon" : "POS"
  );
  const [warehouseId,    setWarehouseId]    = useState<number | null>(
    isInvManager ? (currentUser?.warehouseId ?? null) : null
  );

  // Super admin — location type picker
  const [locationType,   setLocationType]   = useState<"store" | "warehouse" | null>(
    isStoreManager ? "store" : isInvManager ? "warehouse" : null
  );
  // Super admin — store picker
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(
    isStoreManager ? (currentUser?.storeId ?? null) : null
  );
  const [stockInput,     setStockInput]     = useState("");
  const [scanLoading,    setScanLoading]    = useState(false);
  const [scanError,      setScanError]      = useState<string | null>(null);
  const [lastScanned,    setLastScanned]    = useState<Product | null>(null);
  const [cart,           setCart]           = useState<CartItem[]>([]);
  const [gstMode,        setGstMode]        = useState<GSTMode>("intrastate");
  const [customerName,   setCustomerName]   = useState("");
  const [customerPhone,  setCustomerPhone]  = useState("");
  const [discount,       setDiscount]       = useState("");
  const [paymentMethod,  setPaymentMethod]  = useState<PaymentMethod>("cash");
  const [receivedAmount, setReceivedAmount] = useState("");
  const [showInvoice,    setShowInvoice]    = useState(false);
  const [invoiceData,    setInvoiceData]    = useState<InvoiceData | null>(null);

  const scanRef  = useRef<HTMLInputElement>(null);
  // FIX: printRef typed as HTMLDivElement to match useReactToPrint expectations
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scanRef.current?.focus(); }, []);

  // ── Stores (super admin only) ──────────────────────────────────────────────
  const { data: stores = [] } = useQuery<Store[]>({
    queryKey: ["billing-stores"],
    queryFn:  async () => {
      try {
        const r    = await api.get("/v2/Billing/stores");
        const data = r.data;
        const list = Array.isArray(data) ? data : (data?.list ?? data?.data ?? data?.items ?? data?.result ?? []);
        if (list.length > 0) return list.map((s: any) => ({
          storeId:   Number(s.storeId   ?? s.StoreId),
          storeName: s.storeName ?? s.StoreName ?? "",
          address:   s.address   ?? s.Address   ?? "",
          phone:     s.phone     ?? s.Phone     ?? "",
          city:      s.city      ?? s.City      ?? "",
          state:     s.state     ?? s.State     ?? "",
          pinCode:   s.pinCode   ?? s.PinCode   ?? "",
        }));
      } catch { /* fall through */ }
      const r    = await api.get("/Stores", { params: { "Page.Size": 200 } });
      const data = r.data;
      const list = Array.isArray(data) ? data : (data?.list ?? data?.data ?? data?.items ?? data?.result ?? []);
      return list.map((s: any) => ({
        storeId:   Number(s.storeId   ?? s.StoreId),
        storeName: s.storeName ?? s.StoreName ?? "",
        address:   s.address   ?? s.Address   ?? "",
        phone:     s.phone     ?? s.Phone     ?? "",
        city:      s.city      ?? s.City      ?? "",
        state:     s.state     ?? s.State     ?? "",
        pinCode:   s.pinCode   ?? s.PinCode   ?? "",
      })).filter((s: Store) => s.storeId && s.storeName);
    },
    enabled:   isSuperAdmin,
    staleTime: 5 * 60 * 1000,
  });

  // ── Warehouses ─────────────────────────────────────────────────────────────
  const { data: warehouses = [] } = useQuery<Warehouse[]>({
    queryKey: ["billing-warehouses"],
    queryFn:  async () => {
      const r    = await api.get("/v2/Billing/warehouses");
      const data = r.data;
      const list = Array.isArray(data) ? data : (data?.list ?? data?.data ?? data?.items ?? data?.result ?? []);
      return list.map((w: any) => ({
        warehouseId:   Number(w.warehouseId   ?? w.WarehouseId),
        warehouseName: w.warehouseName ?? w.WarehouseName ?? "",
        address:       w.address       ?? w.Address       ?? "",
        contactPhone:  w.contactPhone  ?? w.ContactPhone  ?? "",
      })).filter((w: Warehouse) => w.warehouseId && w.warehouseName);
    },
    enabled:   isSuperAdmin || isInvManager,
    staleTime: 5 * 60 * 1000,
  });

  // ── Derived effective values (what gets sent to API) ───────────────────────
  const effectiveStoreId: number | null = (() => {
    if (isStoreManager)  return currentUser?.storeId ?? null;
    if (isSuperAdmin && locationType === "store") return selectedStoreId;
    return null;
  })();

  const effectiveWarehouseId: number | null = (() => {
    if (isInvManager)    return currentUser?.warehouseId ?? null;
    if (isSuperAdmin && locationType === "warehouse") return warehouseId;
    return null;
  })();

  console.log("🔍 effectiveWarehouseId:", effectiveWarehouseId);


  const effectiveChannel: Channel = (() => {
    if (isStoreManager)  return "POS";
    if (isSuperAdmin && locationType === "store") return "POS";
    return channel;
  })();

  // Billing is ready only when all required selections are made
  const locationReady: boolean = (() => {
    if (isStoreManager)  return true;
    if (isInvManager)    return !!channel && channel !== "POS";
    if (isSuperAdmin) {
      if (locationType === "store")     return !!selectedStoreId;
      if (locationType === "warehouse") return !!warehouseId && !!channel && channel !== "POS";
    }
    return false;
  })();

  // ── Derived channel info ───────────────────────────────────────────────────
  const isOnline    = effectiveChannel !== "POS";
  const channelMeta = CHANNELS.find(c => c.id === effectiveChannel)!;

  // ── Totals ─────────────────────────────────────────────────────────────────
  const subtotal     = +(cart.reduce((s,i) => s + i.subtotal, 0)).toFixed(2);
  const cgstTotal    = +(cart.reduce((s,i) => s + i.cgst,     0)).toFixed(2);
  const sgstTotal    = +(cart.reduce((s,i) => s + i.sgst,     0)).toFixed(2);
  const igstTotal    = +(cart.reduce((s,i) => s + i.igst,     0)).toFixed(2);
  const gstTotal     = +(cart.reduce((s,i) => s + i.gstAmount,0)).toFixed(2);
  const discountAmt  = parseFloat(discount) || 0;
  const grandTotal   = +(subtotal + gstTotal - discountAmt).toFixed(2);
  const received     = parseFloat(receivedAmount) || 0;
  const balance      = +(received - grandTotal).toFixed(2);

  // ── Scan product ───────────────────────────────────────────────────────────
  const fetchProduct = useCallback(async (raw: string) => {
    const id = raw.trim().toUpperCase();
    if (!id) return;

    if (!locationReady) {
      toast.error("Please select a location first.");
      return;
    }

    setScanLoading(true);
    setScanError(null);

    try {
      // Always tell backend exactly which location to check stock against
      const params: Record<string, any> = {};

      if (effectiveStoreId) {
        // Store billing — check stock ONLY in this store
        params.store_id = effectiveStoreId;
        params.channel  = "POS";
      } else if (effectiveWarehouseId) {
        // Warehouse billing — check stock ONLY in this warehouse
        params.warehouse_id = effectiveWarehouseId;
        params.channel      = effectiveChannel;  // Amazon / Flipkart / Meesho
      }

      const res = await api.get<Product>(`/v2/Billing/product/${encodeURIComponent(id)}`, { params });
      
      const p   = res.data;

      if (!p?.stockId) throw new Error("Unexpected server response.");

      setLastScanned(p);
      setCart(prev => {
        const ex = prev.find(i => i.stockId === p.stockId);
        if (ex) {
          const newQty = ex.quantity + 1;
          if (newQty > p.availableQuantity) {
            toast.error(`Only ${p.availableQuantity} units available for ${p.productName}.`);
            return prev;
          }
          return prev.map(i => i.stockId === p.stockId ? recalc({...i, quantity: newQty}, gstMode) : i);
        }
        return [...prev, toCartItem(p, gstMode)];
      });

      toast.success(`Added: ${p.productName} (${p.size} / ${p.color})`);
      setStockInput("");
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "Product not found.";
      setScanError(msg);
      toast.error(msg);
    } finally {
      setScanLoading(false);
      setTimeout(() => scanRef.current?.focus(), 50);
    }
  }, [gstMode, effectiveChannel, effectiveStoreId, effectiveWarehouseId, locationReady]);

  // ── Location type change (super admin only) ────────────────────────────────
  const changeLocationType = (type: "store" | "warehouse") => {
    if (cart.length > 0) {
      if (!confirm("Switching location will clear the current cart. Continue?")) return;
    }
    setLocationType(type);
    setSelectedStoreId(null);
    setWarehouseId(null);
    setChannel(type === "store" ? "POS" : "Amazon");
    setCart([]);
    setLastScanned(null);
    setScanError(null);
  };

  // ── Channel change (clears cart) ───────────────────────────────────────────
  const changeChannel = (ch: Channel) => {
    if (cart.length > 0) {
      if (!confirm(`Switching to ${ch} will clear the current cart. Continue?`)) return;
    }
    setChannel(ch);
    setCart([]);
    setLastScanned(null);
    setScanError(null);
  };

  // ── GST mode ───────────────────────────────────────────────────────────────
  const toggleGSTMode = (mode: GSTMode) => {
    setGstMode(mode);
    setCart(prev => prev.map(i => recalc(i, mode)));
  };

  // ── Cart ops ───────────────────────────────────────────────────────────────
  const bumpQty = (cartId: string, delta: number) =>
    setCart(prev =>
      prev.map(i => {
        if (i.cartId !== cartId) return i;
        const nq = i.quantity + delta;
        if (nq > i.availableQuantity) { toast.error(`Max available: ${i.availableQuantity}`); return i; }
        return recalc({ ...i, quantity: nq }, gstMode);
      }).filter(i => i.quantity > 0)
    );

  const setQty = (cartId: string, val: number) => {
    if (isNaN(val) || val < 0) return;
    setCart(prev =>
      val === 0
        ? prev.filter(i => i.cartId !== cartId)
        : prev.map(i => {
            if (i.cartId !== cartId) return i;
            if (val > i.availableQuantity) { toast.error(`Max available: ${i.availableQuantity}`); return i; }
            return recalc({ ...i, quantity: val }, gstMode);
          })
    );
  };

  const removeItem = (cartId: string) => setCart(prev => prev.filter(i => i.cartId !== cartId));
  const clearCart  = () => { setCart([]); setLastScanned(null); setScanError(null); };

  // ── Save order ─────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ orderId: number; invoiceNo: string }>(
        "/v2/Billing/orders",
        {
          customerName:  customerName || null,
          customerPhone: customerPhone || null,
          gstMode, paymentMethod,
          channel:       effectiveChannel,
          storeId:       effectiveStoreId   ?? undefined,
          warehouseId:   effectiveWarehouseId ?? undefined,
          items: cart.map(i => ({
            stockId: i.stockId, productName: i.productName, size: i.size, color: i.color,
            hsnCode: i.hsnCode, gstPercent: i.gstPercent, price: i.price, quantity: i.quantity,
            subtotal: i.subtotal, gstAmount: i.gstAmount, cgst: i.cgst, sgst: i.sgst,
            igst: i.igst, lineTotal: i.lineTotal,
          })),
          subtotal, gstTotal, cgstTotal, sgstTotal, igstTotal,
          discount: discountAmt, grandTotal, receivedAmount: received, balance,
        }
      );
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Bill ${data.invoiceNo} saved!`);

      // Resolve location details for invoice header
      const selectedStore = stores.find(s => s.storeId === effectiveStoreId);
      const selectedWH    = warehouses.find(w => w.warehouseId === effectiveWarehouseId);
      const isWH          = !!effectiveWarehouseId;

      const locationName    = isWH
        ? (selectedWH?.warehouseName || currentUser.warehouseName || "Warehouse")
        : (selectedStore?.storeName  || currentUser.storeName     || "TWAM");

      const locationAddress = isWH
        ? (selectedWH?.address || "")
        : selectedStore
          ? [selectedStore.address, selectedStore.city, selectedStore.state, selectedStore.pinCode]
              .filter(Boolean).join(", ")
          : "";

      const locationPhone = isWH
        ? (selectedWH?.contactPhone || "")
        : (selectedStore?.phone     || "");

      setInvoiceData({
        invoiceNo: data.invoiceNo, channel: effectiveChannel,
        date: new Date().toLocaleDateString("en-IN", { day:"2-digit", month:"2-digit", year:"numeric" }),
        customerName:    customerName || "Walk-in Customer",
        customerPhone,
        cart:            [...cart],
        subtotal, cgstTotal, sgstTotal, igstTotal, gstTotal,
        discount:        discountAmt, grandTotal, gstMode, paymentMethod,
        receivedAmount:  received, balance,
        locationName, locationAddress, locationPhone,
        isWarehouse:     isWH,
      });
      setShowInvoice(true);
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "Failed to save order."),
  });

  const handleGenerate = () => {
    if (!cart.length)      { toast.error("Cart is empty."); return; }
    if (!locationReady)    { toast.error("Please complete location and channel selection."); return; }
    if (isOnline && !effectiveWarehouseId) { toast.error("Please select a warehouse for online orders."); return; }
    saveMutation.mutate();
  };

  // FIX: useReactToPrint — contentRef is the correct prop in newer versions;
  //      falls back gracefully to content callback for older versions.
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: invoiceData?.invoiceNo || "Invoice",
  } as any);

  const handleDownload = () => {
    if (!printRef.current) return;
    const html    = printRef.current.innerHTML;
    const full    = `<!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>${invoiceData?.invoiceNo || "Invoice"}</title>
      <style>body{font-family:Arial,sans-serif;margin:0;padding:24px}</style>
      </head><body>${html}</body></html>`;
    const blob    = new Blob([full], { type: "text/html" });
    const url     = URL.createObjectURL(blob);
    const a       = document.createElement("a");
    a.href        = url;
    a.download    = `${invoiceData?.invoiceNo || "Invoice"}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Invoice downloaded!");
  };

  const handleShare = async () => {
    if (!printRef.current || !invoiceData) return;
    const text = `Invoice ${invoiceData.invoiceNo}\nDate: ${invoiceData.date}\nChannel: ${invoiceData.channel}\nTotal: ₹${fmt(invoiceData.grandTotal)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: invoiceData.invoiceNo, text });
        toast.success("Invoice shared!");
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(text);
      toast.success("Invoice details copied to clipboard!");
    }
  };

  const handleNewBill = () => {
    clearCart();
    setCustomerName(""); setCustomerPhone("");
    setDiscount(""); setReceivedAmount("");
    setPaymentMethod("cash"); setShowInvoice(false); setInvoiceData(null);
    setTimeout(() => scanRef.current?.focus(), 100);
  };

  // =============================================================================
  //  RENDER
  // =============================================================================
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Sans:wght@400;500;600&display=swap');
        .ab2 *, .ab2 *::before, .ab2 *::after { box-sizing: border-box; }
        .ab2 { font-family: 'DM Sans', sans-serif; background: #F5F0E6; min-height: 100vh; color: #3b1c25; }
        .serif { font-family: 'Cormorant Garamond', Georgia, serif; }
        .inp { width:100%; border:1.5px solid #ddd0c8; border-radius:8px; background:#fff;
               padding:.62rem .875rem; font-size:.875rem; color:#3b1c25; font-family:inherit;
               outline:none; transition:border-color .15s,box-shadow .15s; }
        .inp::placeholder { color:#b89aa6; }
        .inp:focus { border-color:#6B0F2A; box-shadow:0 0 0 3px rgba(107,15,42,.10); }
        .sel { appearance:none; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239E6070' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
               background-repeat:no-repeat; background-position:right 10px center; padding-right:2rem; cursor:pointer; }
        .lbl { font-size:.67rem; font-weight:700; letter-spacing:.1em; text-transform:uppercase;
               color:#9E6070; display:block; margin-bottom:5px; }
        .btn { display:inline-flex; align-items:center; gap:7px; font-family:'DM Sans',sans-serif;
               font-weight:600; cursor:pointer; border:none; transition:all .15s; }
        .btn-p { background:#6B0F2A; color:#F5F0E6; border-radius:9px; padding:.65rem 1.375rem;
                 font-size:.875rem; box-shadow:0 2px 10px rgba(107,15,42,.28); }
        .btn-p:hover:not(:disabled) { background:#8a1235; transform:translateY(-1px); }
        .btn-p:disabled { opacity:.6; cursor:not-allowed; }
        .btn-s { background:transparent; color:#6B0F2A; border:1.5px solid #ddd0c8; border-radius:8px;
                 padding:.55rem 1.1rem; font-size:.8rem; }
        .btn-s:hover { border-color:#9E6070; background:#fdf4f7; }

        /* Channel selector */
        .ch-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
        .ch-card { border:2px solid #e8ddd5; border-radius:10px; padding:10px 6px; cursor:pointer;
                   transition:all .15s; background:#fdf8f4; text-align:center; }
        .ch-card:hover { border-color:#9E6070; background:#fff; }
        .ch-card.active { border-color:#6B0F2A; background:#f0e0e7; }
        .ch-card .emoji { font-size:1.4rem; display:block; margin-bottom:4px; }
        .ch-card .label { font-size:.65rem; font-weight:700; text-transform:uppercase; letter-spacing:.06em; }

        /* Cart */
        .ct { width:100%; border-collapse:collapse; }
        .ct thead tr { background:#6B0F2A; }
        .ct th { padding:9px 10px; color:#F5F0E6; font-size:.68rem; font-weight:700;
                 letter-spacing:.07em; text-transform:uppercase; white-space:nowrap; }
        .ct th:first-child { border-radius:8px 0 0 0; } .ct th:last-child { border-radius:0 8px 0 0; }
        .ct tbody tr { border-bottom:1px solid #f0e8e4; transition:background .12s; }
        .ct tbody tr:hover { background:#fdf8f4; }
        .ct td { padding:8px 10px; font-size:.8rem; vertical-align:middle; }
        .ct tfoot tr { border-top:2px solid #e8ddd5; background:#fdf8f4; }
        .ct tfoot td { padding:9px 10px; font-weight:700; font-size:.82rem; }

        /* Payment */
        .pm { border:2px solid transparent; border-radius:10px; padding:11px 8px; cursor:pointer;
              transition:all .15s; background:#fdf8f4; text-align:center; flex:1; }
        .pm.on { border-color:#6B0F2A; background:#f0e0e7; }
        .pm:hover:not(.on) { border-color:#ddd0c8; background:#fff; }

        /* Alerts */
        .err { display:flex; align-items:flex-start; gap:8px; background:#fef2f2;
               border:1.5px solid #fecaca; border-radius:9px; padding:10px 14px;
               color:#b91c1c; font-size:.8rem; font-weight:500; margin-top:10px; line-height:1.4; }
        .ok  { display:flex; align-items:center; gap:8px; background:#f0fdf4;
               border:1.5px solid #bbf7d0; border-radius:9px; padding:10px 14px;
               color:#15803d; font-size:.8rem; font-weight:500; margin-top:10px; }
        .warn { display:flex; align-items:center; gap:8px; background:#fffbeb;
                border:1.5px solid #fde68a; border-radius:9px; padding:10px 14px;
                color:#92400e; font-size:.8rem; font-weight:500; margin-top:10px; }

        /* Modal */
        .mb { position:fixed; inset:0; z-index:100; background:rgba(59,28,37,.52);
              backdrop-filter:blur(5px); display:flex; align-items:flex-start;
              justify-content:center; padding:1.5rem 1rem; overflow-y:auto; }
        .mbox { background:#fff; border-radius:18px; width:100%; max-width:800px;
                box-shadow:0 30px 80px rgba(107,15,42,.26); border:1.5px solid #e8ddd5;
                animation:mIn .22s cubic-bezier(.34,1.56,.64,1); }
        @keyframes mIn { from{opacity:0;transform:scale(.95) translateY(14px)} to{opacity:1;transform:scale(1) translateY(0)} }

        .spin { animation:sp 1s linear infinite; }
        @keyframes sp { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .empty { display:flex; flex-direction:column; align-items:center; justify-content:center;
                 padding:3rem 1rem; gap:12px; text-align:center; }

        @media (max-width:1100px) { .layout { flex-direction:column !important; } .rhs { width:100% !important; } }
        @media (max-width:620px)  { .tgrid { grid-template-columns:1fr !important; }
                                    .ch-grid { grid-template-columns:repeat(2,1fr) !important; } }
        @media print { .noprint { display:none !important; } }
      `}</style>

      <div className="ab2">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="noprint" style={{ background:"#fff", borderBottom:"1.5px solid #e8ddd5",
             padding:"1rem 1.75rem", boxShadow:"0 2px 8px rgba(107,15,42,.06)",
             display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
          <div>
            <h1 className="serif" style={{ fontSize:"1.8rem", fontWeight:700, color:"#6B0F2A", margin:0, lineHeight:1 }}>
              Point of Sale
            </h1>
            <p style={{ fontSize:".75rem", color:"#9E6070", margin:"4px 0 0" }}>
              {new Date().toLocaleDateString("en-IN", { weekday:"long", day:"2-digit", month:"long", year:"numeric" })}
              &nbsp;·&nbsp;
              <span style={{ fontWeight:600 }}>{channelMeta.emoji} {channelMeta.label}</span>
            </p>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
            {/* GST mode pills */}
            <div style={{ display:"flex", gap:6, background:"#fdf8f4", border:"1.5px solid #e8ddd5",
                          borderRadius:10, padding:"4px 6px" }}>
              {(["intrastate","interstate"] as GSTMode[]).map(m => (
                <button key={m} type="button" onClick={() => toggleGSTMode(m)}
                  style={{ padding:".4rem 1rem", borderRadius:999, fontFamily:"inherit",
                           border: gstMode===m ? "none" : "1.5px solid #ddd0c8",
                           background: gstMode===m ? "#6B0F2A" : "transparent",
                           color: gstMode===m ? "#F5F0E6" : "#9E6070",
                           fontWeight:600, fontSize:".78rem", cursor:"pointer", letterSpacing:".02em" }}>
                  {m === "intrastate" ? "Intrastate (CGST+SGST)" : "Interstate (IGST)"}
                </button>
              ))}
            </div>
            {cart.length > 0 && (
              <button className="btn btn-s" onClick={clearCart}>
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Clear Cart
              </button>
            )}
          </div>
        </div>

        {/* ── Main layout ─────────────────────────────────────────────────── */}
        <div className="layout" style={{ display:"flex", gap:"1.25rem", padding:"1.25rem 1.75rem", alignItems:"flex-start" }}>

          {/* LEFT */}
          <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", gap:"1.25rem" }}>

            {/* ── ROLE-BASED LOCATION + CHANNEL SELECTOR ── */}
            <Card>
              <CardHeader
                icon={icn("M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12")}
                title="Sales Channel"
                right={
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    {isStoreManager && (
                      <span style={{ fontSize:".72rem", fontWeight:600, color:"#15803d",
                                     background:"#f0fdf4", border:"1px solid #bbf7d0",
                                     borderRadius:999, padding:"2px 10px" }}>
                        🏪 {currentUser?.storeName || "Your Store"} · POS
                      </span>
                    )}
                    {isInvManager && (
                      <span style={{ fontSize:".72rem", fontWeight:600, color:"#92400e",
                                     background:"#fffbeb", border:"1px solid #fde68a",
                                     borderRadius:999, padding:"2px 10px" }}>
                        🏭 {currentUser?.warehouseName || "Your Warehouse"}
                      </span>
                    )}
                  </div>
                }
              />
              <div style={{ padding:"16px 18px" }}>

                {/* ══ SUPER ADMIN — Step 1: Location type picker ══ */}
                {isSuperAdmin && (
                  <>
                    <p style={{ fontSize:".7rem", fontWeight:700, letterSpacing:".1em",
                                textTransform:"uppercase", color:"#9E6070", margin:"0 0 10px" }}>
                      Step 1 — Select Location
                    </p>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
                      {[
                        { value:"store",     label:"Store / POS",  emoji:"🏪",
                          sub:"In-store billing", color:"#15803d", bg:"#f0fdf4", border:"#bbf7d0" },
                        { value:"warehouse", label:"Warehouse",     emoji:"🏭",
                          sub:"Online fulfilment", color:"#92400e", bg:"#fffbeb", border:"#fde68a" },
                      ].map(opt => (
                        <div key={opt.value}
                             onClick={() => changeLocationType(opt.value as "store" | "warehouse")}
                             style={{
                               border: `2px solid ${locationType === opt.value ? opt.color : "#e8ddd5"}`,
                               borderRadius:12, padding:"14px 16px", cursor:"pointer",
                               background: locationType === opt.value ? opt.bg : "#fdf8f4",
                               transition:"all .15s", display:"flex", alignItems:"center", gap:12,
                             }}>
                          <span style={{ fontSize:"1.8rem" }}>{opt.emoji}</span>
                          <div>
                            <div style={{ fontWeight:700, fontSize:".82rem",
                                          color: locationType === opt.value ? opt.color : "#3b1c25" }}>
                              {opt.label}
                            </div>
                            <div style={{ fontSize:".7rem", color:"#9E6070", marginTop:2 }}>{opt.sub}</div>
                          </div>
                          {locationType === opt.value && (
                            <svg style={{ marginLeft:"auto", flexShrink:0 }} width="16" height="16"
                                 fill={opt.color} viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                            </svg>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Super admin — Store dropdown */}
                    {locationType === "store" && (
                      <div style={{ marginBottom:14 }}>
                        <label className="lbl">Select Store</label>
                        <select className="inp sel" value={selectedStoreId ?? ""}
                                onChange={e => setSelectedStoreId(e.target.value ? Number(e.target.value) : null)}>
                          <option value="">— Choose a store —</option>
                          {stores.map(s => (
                            <option key={s.storeId} value={s.storeId}>{s.storeName}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Super admin — Warehouse dropdown */}
                    {locationType === "warehouse" && (
                      <div style={{ marginBottom:14 }}>
                        <label className="lbl">Select Warehouse</label>
                        <select className="inp sel" value={warehouseId ?? ""}
                                onChange={e => setWarehouseId(e.target.value ? Number(e.target.value) : null)}>
                          <option value="">— Choose a warehouse —</option>
                          {warehouses.map(w => (
                            <option key={w.warehouseId} value={w.warehouseId}>{w.warehouseName}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </>
                )}

                {/* ══ ONLINE CHANNEL PICKER
                     Shows for:
                       - Super Admin  → only after warehouse is selected
                       - Inv Manager  → always (locked to their warehouse)
                ══ */}
                {(isInvManager || (isSuperAdmin && locationType === "warehouse" && !!warehouseId)) && (
                  <>
                    {isSuperAdmin && (
                      <p style={{ fontSize:".7rem", fontWeight:700, letterSpacing:".1em",
                                  textTransform:"uppercase", color:"#9E6070", margin:"0 0 10px" }}>
                        Step 2 — Select Sales Channel
                      </p>
                    )}
                    {isInvManager && (
                      <p style={{ fontSize:".7rem", fontWeight:700, letterSpacing:".1em",
                                  textTransform:"uppercase", color:"#9E6070", margin:"0 0 10px" }}>
                        Select Sales Channel
                      </p>
                    )}
                    <div className="ch-grid" style={{ gridTemplateColumns:"repeat(3,1fr)" }}>
                      {CHANNELS.filter(c => c.online).map(ch => (
                        <div key={ch.id} className={`ch-card ${channel === ch.id ? "active" : ""}`}
                             onClick={() => changeChannel(ch.id)}>
                          <span className="emoji">{ch.emoji}</span>
                          <span className="label" style={{ color: channel===ch.id ? "#6B0F2A" : "#9E6070" }}>
                            {ch.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* ══ STORE MANAGER — locked, nothing to pick, just show info ══ */}
                {isStoreManager && (
                  <div style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px",
                                background:"#f0fdf4", border:"1.5px solid #bbf7d0", borderRadius:10 }}>
                    <span style={{ fontSize:"1.5rem" }}>🏪</span>
                    <div>
                      <div style={{ fontWeight:700, fontSize:".82rem", color:"#15803d" }}>
                        {currentUser?.storeName || "Your Store"}
                      </div>
                      <div style={{ fontSize:".7rem", color:"#9E6070", marginTop:2 }}>
                        POS · In-store billing only
                      </div>
                    </div>
                    <span style={{ marginLeft:"auto", background:"#6B0F2A", color:"#F5F0E6",
                                   borderRadius:999, padding:"3px 12px", fontSize:".7rem", fontWeight:700 }}>
                      POS
                    </span>
                  </div>
                )}

              </div>
            </Card>

            {/* Customer + Scan */}
            <div className="tgrid" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.25rem" }}>
              {/* Customer */}
              <Card>
                <CardHeader icon={icn("M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0")} title="Customer" />
                <div style={{ padding:"16px 18px", display:"flex", flexDirection:"column", gap:12 }}>
                  <div>
                    <label className="lbl">Name (optional)</label>
                    <input className="inp" placeholder="Walk-in Customer" value={customerName}
                           onChange={e => setCustomerName(e.target.value)} />
                  </div>
                  <div>
                    <label className="lbl">Phone (optional)</label>
                    <input className="inp" type="tel" placeholder="+91 98765 43210" value={customerPhone}
                           onChange={e => setCustomerPhone(e.target.value)} maxLength={15} />
                  </div>
                </div>
              </Card>

              {/* Scan */}
              <Card>
                <CardHeader icon={icn("M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5z")} title="Scan / Enter Stock ID" />
                <div style={{ padding:"16px 18px" }}>
                  <label className="lbl">Stock ID or Barcode</label>
                  <div style={{ display:"flex", gap:8 }}>
                    <div style={{ flex:1, position:"relative" }}>
                      <input ref={scanRef} className="inp" placeholder="Scan or type Stock ID, then Enter…"
                             style={{ paddingRight: scanLoading ? "2.5rem" : ".875rem" }}
                             value={stockInput}
                             onChange={e => { setStockInput(e.target.value); if (scanError) setScanError(null); }}
                             onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); fetchProduct(stockInput); } }}
                             autoComplete="off" spellCheck={false} />
                      {scanLoading && (
                        <span style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)" }}>
                          <Spinner size={14} />
                        </span>
                      )}
                    </div>
                    <button className="btn btn-p" style={{ padding:".62rem 1rem", flexShrink:0 }}
                            onClick={() => fetchProduct(stockInput)}
                            disabled={scanLoading || !stockInput.trim()}>Add</button>
                  </div>

                  {scanError && (
                    <div className="err">
                      <svg width="14" height="14" fill="currentColor" viewBox="0 0 20 20" style={{ flexShrink:0, marginTop:1 }}>
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                      </svg>
                      {scanError}
                    </div>
                  )}

                  {!scanError && lastScanned && cart.length > 0 && (
                    <div className="ok">
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      <span>
                        <strong>{lastScanned.productName}</strong> — {lastScanned.size} / {lastScanned.color} @ ₹{fmt(lastScanned.price)}
                        <span style={{ color:"#9E6070", marginLeft:6, fontSize:".72rem" }}>({lastScanned.stockId})</span>
                        &nbsp;<Badge color="#9E6070">{lastScanned.availableQuantity} avail</Badge>
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Cart */}
            <Card>
              <CardHeader
                icon={icn("M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75")}
                title="Cart"
                right={cart.length > 0 && (
                  <span style={{ background:"#6B0F2A", color:"#F5F0E6", fontSize:".68rem", fontWeight:700,
                                 borderRadius:999, padding:"2px 9px" }}>
                    {cart.reduce((s,i) => s + i.quantity, 0)} item{cart.reduce((s,i) => s+i.quantity,0) !== 1 ? "s" : ""}
                  </span>
                )}
              />
              <div style={{ overflowX:"auto" }}>
                {cart.length === 0 ? (
                  <div className="empty">
                    <svg width="44" height="44" fill="none" stroke="#ddd0c8" strokeWidth={1.2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272" />
                    </svg>
                    <p style={{ fontSize:".875rem", fontWeight:600, color:"#9E6070", margin:0 }}>Cart is empty</p>
                    <p style={{ fontSize:".78rem", color:"#b89aa6", margin:0 }}>
                      {isOnline && !warehouseId ? "Select a warehouse and then scan a Stock ID" : "Scan a barcode or type a Stock ID to begin"}
                    </p>
                  </div>
                ) : (
                  <table className="ct">
                    <thead>
                      <tr>
                        {["Stock ID","Product","Size","Color","Price","GST%","Qty","Stock","GST Amt","Total",""].map(h => (
                          <th key={h} style={{ textAlign: (["Price","GST Amt","Total"].includes(h) ? "right" : (h === "Qty" || h === "Stock" ? "center" : "left")) as React.CSSProperties["textAlign"] }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cart.map(item => (
                        <tr key={item.cartId}>
                          <td style={{ fontFamily:"monospace", fontSize:".73rem", color:"#9E6070" }}>{item.stockId}</td>
                          <td style={{ fontWeight:600, color:"#3b1c25", whiteSpace:"nowrap" }}>{item.productName}</td>
                          <td style={{ color:"#9E6070" }}>{item.size}</td>
                          <td style={{ color:"#9E6070" }}>{item.color}</td>
                          <td style={{ textAlign:"right" }}>₹{fmt(item.price)}</td>
                          <td style={{ textAlign:"center" }}>
                            <Badge color="#A84C6B">{item.gstPercent}%</Badge>
                          </td>
                          <td style={{ textAlign:"center" }}>
                            <div style={{ display:"flex", alignItems:"center", gap:5, justifyContent:"center" }}>
                              <QtyBtn onClick={() => bumpQty(item.cartId, -1)}>−</QtyBtn>
                              <input style={{ width:36, textAlign:"center", border:"1.5px solid #ddd0c8",
                                             borderRadius:6, padding:"2px 4px", fontSize:".82rem",
                                             fontFamily:"inherit", outline:"none", color:"#3b1c25" }}
                                     value={item.quantity}
                                     onChange={e => setQty(item.cartId, parseInt(e.target.value) || 0)}
                                     onFocus={e => e.currentTarget.select()} />
                              <QtyBtn onClick={() => bumpQty(item.cartId, 1)}>+</QtyBtn>
                            </div>
                          </td>
                          <td style={{ textAlign:"center" }}>
                            <Badge color={item.quantity >= item.availableQuantity ? "#dc2626" : "#16a34a"}>
                              {item.availableQuantity}
                            </Badge>
                          </td>
                          <td style={{ textAlign:"right", fontSize:".75rem", color:"#9E6070" }}>
                            {gstMode === "intrastate"
                              ? `₹${fmt(item.cgst)}+₹${fmt(item.sgst)}`
                              : `₹${fmt(item.igst)}`}
                          </td>
                          <td style={{ textAlign:"right", fontWeight:700, color:"#6B0F2A" }}>
                            ₹{fmt(item.lineTotal)}
                          </td>
                          <td>
                            <button type="button" onClick={() => removeItem(item.cartId)}
                              style={{ border:"none", background:"transparent", cursor:"pointer",
                                       color:"#c97070", padding:4, borderRadius:6, display:"flex", alignItems:"center" }}>
                              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={6} style={{ color:"#9E6070" }}>Totals</td>
                        <td style={{ textAlign:"center" }}>{cart.reduce((s,i) => s+i.quantity, 0)}</td>
                        <td />
                        <td style={{ textAlign:"right", color:"#A84C6B" }}>₹{fmt(gstTotal)}</td>
                        <td style={{ textAlign:"right", color:"#6B0F2A", fontSize:".88rem" }}>₹{fmt(subtotal + gstTotal)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </Card>
          </div>

          {/* RHS — Summary + Payment */}
          <div className="rhs" style={{ width:310, flexShrink:0, display:"flex", flexDirection:"column", gap:"1.25rem" }}>

            {/* Channel info banner */}
            <div style={{ background: isOnline ? "#fef9e7" : "#f0fdf4",
                          border: `1.5px solid ${isOnline ? "#fde68a" : "#bbf7d0"}`,
                          borderRadius:12, padding:"12px 16px",
                          display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:"1.6rem" }}>{channelMeta.emoji}</span>
              <div>
                <div style={{ fontWeight:700, fontSize:".82rem", color: isOnline ? "#92400e" : "#15803d" }}>
                  {channelMeta.label}
                </div>
                <div style={{ fontSize:".72rem", color:"#9E6070", marginTop:2 }}>
                  {isOnline
                    ? effectiveWarehouseId
                      ? `Deducting from warehouse #${effectiveWarehouseId}`
                      : "⚠ Select a warehouse above"
                    : effectiveStoreId
                      ? `Store #${effectiveStoreId} · POS`
                      : isStoreManager
                        ? currentUser?.storeName || "Your Store"
                        : "⚠ Select a store above"}
                </div>
              </div>
              {!locationReady && (
                <span style={{ marginLeft:"auto", fontSize:".68rem", color:"#92400e",
                               background:"#fef3c7", borderRadius:999, padding:"2px 8px", fontWeight:600 }}>
                  Incomplete
                </span>
              )}
            </div>

            {/* Summary */}
            <Card>
              <CardHeader icon={icn("M9 7h6m0 10v-3m-3 3h.01M9 17h.01")} title="Bill Summary" />
              <div style={{ padding:"14px 18px", display:"flex", flexDirection:"column", gap:2 }}>
                <SumRow label="Subtotal" value={`₹${fmt(subtotal)}`} />
                {gstMode === "intrastate"
                  ? <><SumRow label="CGST" value={`₹${fmt(cgstTotal)}`} muted />
                      <SumRow label="SGST" value={`₹${fmt(sgstTotal)}`} muted /></>
                  : <SumRow label="IGST" value={`₹${fmt(igstTotal)}`} muted />}
                <SumRow label="GST Total" value={`₹${fmt(gstTotal)}`} />
                <div style={{ padding:"8px 0", borderTop:"1px dotted #e8ddd5" }}>
                  <label className="lbl">Discount (₹)</label>
                  <input className="inp" style={{ marginTop:4 }} placeholder="0.00"
                         value={discount} onChange={e => setDiscount(e.target.value.replace(/[^0-9.]/g,""))} />
                </div>
                {discountAmt > 0 && <SumRow label="Discount" value={`−₹${fmt(discountAmt)}`} green />}
                <SumRow label="Grand Total" value={`₹${fmt(grandTotal)}`} highlight />
                {cart.length > 0 && (
                  <p style={{ fontSize:".7rem", color:"#9E6070", fontStyle:"italic", marginTop:8, lineHeight:1.5 }}>
                    {inWords(grandTotal)}
                  </p>
                )}
              </div>
            </Card>

            {/* Payment */}
            <Card>
              <CardHeader icon={icn("M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6")} title="Payment" />
              <div style={{ padding:"14px 18px", display:"flex", flexDirection:"column", gap:14 }}>
                <div>
                  <label className="lbl" style={{ marginBottom:8 }}>Method</label>
                  <div style={{ display:"flex", gap:8 }}>
                    {(["cash","upi","card"] as PaymentMethod[]).map(m => (
                      <div key={m} className={`pm ${paymentMethod === m ? "on" : ""}`}
                           onClick={() => setPaymentMethod(m)}>
                        <div style={{ fontSize:"1.3rem", marginBottom:3 }}>
                          {m === "cash" ? "💵" : m === "upi" ? "📱" : "💳"}
                        </div>
                        <div style={{ fontSize:".68rem", fontWeight:700, textTransform:"uppercase",
                                      letterSpacing:".06em", color: paymentMethod===m ? "#6B0F2A" : "#9E6070" }}>
                          {m}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="lbl">Received Amount (₹)</label>
                  <div style={{ position:"relative", marginTop:4 }}>
                    <span style={{ position:"absolute", left:11, top:"50%", transform:"translateY(-50%)",
                                   color:"#9E6070", fontWeight:600 }}>₹</span>
                    <input className="inp" style={{ paddingLeft:"1.75rem" }} placeholder="0.00"
                           value={receivedAmount}
                           onChange={e => setReceivedAmount(e.target.value.replace(/[^0-9.]/g,""))} />
                  </div>
                </div>

                {received > 0 && (
                  <div style={{ borderRadius:9, padding:"10px 14px",
                                background: balance>=0 ? "#f0fdf4" : "#fef2f2",
                                border: `1.5px solid ${balance>=0 ? "#bbf7d0" : "#fecaca"}` }}>
                    <div style={{ display:"flex", justifyContent:"space-between" }}>
                      <span style={{ fontSize:".8rem", fontWeight:600, color: balance>=0?"#15803d":"#b91c1c" }}>
                        {balance >= 0 ? "Change to Return" : "Balance Due"}
                      </span>
                      <span style={{ fontSize:".9rem", fontWeight:800, color: balance>=0?"#15803d":"#b91c1c" }}>
                        ₹{fmt(Math.abs(balance))}
                      </span>
                    </div>
                  </div>
                )}

                <button className="btn btn-p"
                  style={{ width:"100%", justifyContent:"center", padding:".8rem", fontSize:".9rem",
                           borderRadius:11, marginTop:2 }}
                  onClick={handleGenerate}
                  disabled={cart.length === 0 || saveMutation.isPending || !locationReady}>
                  {saveMutation.isPending
                    ? <><Spinner size={15} ivory />Saving…</>
                    : <><svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                         <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25" />
                       </svg>
                       Generate Bill</>}
                </button>

                {!locationReady && (
                  <p style={{ fontSize:".72rem", color:"#92400e", textAlign:"center", margin:0 }}>
                    {isSuperAdmin && !locationType
                      ? "⚠ Select Store or Warehouse to begin"
                      : isSuperAdmin && locationType === "store" && !selectedStoreId
                        ? "⚠ Select a store to enable checkout"
                        : isSuperAdmin && locationType === "warehouse" && !warehouseId
                          ? "⚠ Select a warehouse to enable checkout"
                          : isInvManager && !channel
                            ? "⚠ Select a sales channel to enable checkout"
                            : "⚠ Complete selection to enable checkout"}
                  </p>
                )}
              </div>
            </Card>
          </div>
        </div>

        {/* ── Invoice Modal ────────────────────────────────────────────────── */}
     {showInvoice && invoiceData && (
  <div className="mb noprint">
    <div className="mbox">
      <div style={{ padding:"1rem 1.5rem", borderBottom:"1.5px solid #f0e8e4",
                    display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
        <div>
          <h2 className="serif" style={{ fontSize:"1.4rem", fontWeight:700, color:"#6B0F2A", margin:0 }}>
            Invoice Generated
          </h2>
          <p style={{ fontSize:".75rem", color:"#9E6070", margin:"3px 0 0" }}>
            {invoiceData.invoiceNo} · {invoiceData.date}
            &nbsp;·&nbsp;{CHANNELS.find(c=>c.id===invoiceData.channel)?.emoji} {invoiceData.channel}
            &nbsp;·&nbsp;{invoiceData.locationName}
          </p>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {/* Print */}
          <button className="btn btn-p" onClick={() => handlePrint()}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 15.75v3.75h10.5v-3.75M6.75 8.25V3h10.5v5.25M4.5 8.25h15a1.5 1.5 0 011.5 1.5v6a1.5 1.5 0 01-1.5 1.5h-15a1.5 1.5 0 01-1.5-1.5v-6a1.5 1.5 0 011.5-1.5z" />
            </svg>
            Print
          </button>
          {/* Download */}
          <button className="btn btn-s" onClick={handleDownload}>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Download
          </button>
          {/* Share */}
          <button className="btn btn-s" onClick={handleShare}>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
            </svg>
            Share
          </button>
          {/* New Bill */}
          <button className="btn btn-s" onClick={handleNewBill}>
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Bill
          </button>
        </div>
      </div>

      {/* Invoice preview + print target */}
      <div ref={printRef} style={{ padding:"1.25rem", maxHeight:"75vh", overflowY:"auto" }}>

        {/* ── INVOICE CONTENT ── */}
        <div style={{ fontFamily:"Arial,sans-serif", background:"#fff", color:"#1a1a1a",
                      padding:"24px 28px", maxWidth:740, margin:"0 auto", fontSize:12 }}>

          {/* ══ HEADER: twam brand + store/warehouse name ══ */}
          <div style={{ textAlign:"center", borderBottom:"2.5px solid #6B0F2A",
                        paddingBottom:14, marginBottom:14 }}>

            {/* twam brand */}
            <div style={{ fontSize:34, fontWeight:300, color:"#6B0F2A",
                          letterSpacing:8, fontFamily:"Georgia, serif", marginBottom:4 }}>
              twam
            </div>

            {/* Store / warehouse name */}
            <div style={{ fontSize:15, fontWeight:700, color:"#1a1a1a", letterSpacing:0.5 }}>
              {invoiceData.locationName || "TWAM"}
            </div>

            {invoiceData.locationAddress && (
              <div style={{ color:"#555", fontSize:11, marginTop:3 }}>
                {invoiceData.locationAddress}
              </div>
            )}
            <div style={{ color:"#555", fontSize:11, marginTop:2 }}>
              {invoiceData.locationPhone && <>📞 {invoiceData.locationPhone} &nbsp;|&nbsp;</>}
              GSTIN: 36AABCT1234A1Z5
            </div>
          </div>

          {/* ══ TITLE + CHANNEL ══ */}
          <div style={{ textAlign:"center", marginBottom:14 }}>
            <div style={{ fontSize:14, fontWeight:700, letterSpacing:3,
                          color:"#6B0F2A", textTransform:"uppercase" }}>
              Tax Invoice
            </div>
            <div style={{ marginTop:4, fontSize:11, color:"#9E6070" }}>
              {CHANNELS.find(c => c.id === invoiceData.channel)?.emoji} Channel:{" "}
              <strong>{invoiceData.channel}</strong>
              {invoiceData.isWarehouse && (
                <span style={{ marginLeft:8, color:"#92400e" }}>· Warehouse Fulfilment</span>
              )}
            </div>
          </div>

          {/* ══ BILL TO / INVOICE DETAILS ══ */}
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:14 }}>
            <div>
              {invoiceData.isWarehouse ? (
                <>
                  <div style={{ fontWeight:700, fontSize:10, color:"#6B0F2A",
                                textTransform:"uppercase", letterSpacing:.5, marginBottom:4 }}>
                    Order Info
                  </div>
                  <div style={{ fontWeight:700, fontSize:13 }}>
                    Online Order — {invoiceData.channel}
                  </div>
                  <div style={{ color:"#555", fontSize:11, marginTop:2 }}>
                    Fulfilled via {invoiceData.locationName}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontWeight:700, fontSize:10, color:"#6B0F2A",
                                textTransform:"uppercase", letterSpacing:.5, marginBottom:4 }}>
                    Bill To
                  </div>
                  <div style={{ fontWeight:700, fontSize:13 }}>
                    {invoiceData.customerName || "Walk-in Customer"}
                  </div>
                  {invoiceData.customerPhone && (
                    <div style={{ color:"#555", marginTop:2 }}>📞 {invoiceData.customerPhone}</div>
                  )}
                </>
              )}
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontWeight:700, fontSize:10, color:"#6B0F2A",
                            textTransform:"uppercase", letterSpacing:.5, marginBottom:4 }}>
                Invoice Details
              </div>
              <div style={{ color:"#555" }}>
                Invoice No: <strong style={{ color:"#6B0F2A" }}>{invoiceData.invoiceNo}</strong>
              </div>
              <div style={{ color:"#555", marginTop:2 }}>
                Date: <strong>{invoiceData.date}</strong>
              </div>
            </div>
          </div>

          {/* ══ ITEMS TABLE ══ */}
          <table style={{ width:"100%", borderCollapse:"collapse", marginBottom:14 }}>
            <thead>
              <tr style={{ background:"#6B0F2A" }}>
                {["#","Stock ID","Product","Size","Color","HSN","Qty","Rate",
                  invoiceData.gstMode === "intrastate" ? "CGST+SGST" : "IGST",
                  "Amount",
                ].map((h, i) => (
                  <th key={i} style={{
                    padding:"7px 8px", color:"#F5F0E6", fontSize:10, fontWeight:700,
                    textAlign: (["Rate","CGST+SGST","IGST","Amount"].includes(h)
                      ? "right" : (h === "#" || h === "Qty" ? "center" : "left")) as React.CSSProperties["textAlign"],
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoiceData.cart.map((item, i) => (
                <tr key={item.cartId} style={{ background: i % 2 === 0 ? "#fff" : "#fdf8f4" }}>
                  <td style={{ padding:"6px 8px", textAlign:"center", fontSize:11 }}>{i + 1}</td>
                  <td style={{ padding:"6px 8px", fontFamily:"monospace", fontSize:10, color:"#9E6070" }}>
                    {item.stockId}
                  </td>
                  <td style={{ padding:"6px 8px", fontWeight:700, fontSize:11 }}>{item.productName}</td>
                  <td style={{ padding:"6px 8px", fontSize:11 }}>{item.size}</td>
                  <td style={{ padding:"6px 8px", fontSize:11 }}>{item.color}</td>
                  <td style={{ padding:"6px 8px", fontSize:10, color:"#555" }}>{item.hsnCode}</td>
                  <td style={{ padding:"6px 8px", textAlign:"center", fontSize:11 }}>{item.quantity}</td>
                  <td style={{ padding:"6px 8px", textAlign:"right", fontSize:11 }}>₹{fmt(item.price)}</td>
                  <td style={{ padding:"6px 8px", textAlign:"right", fontSize:11 }}>
                    {invoiceData.gstMode === "intrastate" ? (
                      <>
                        <div>₹{fmt(item.cgst)}</div>
                        <div style={{ color:"#9E6070", fontSize:9 }}>
                          ({item.gstPercent / 2}%+{item.gstPercent / 2}%)
                        </div>
                      </>
                    ) : (
                      <>
                        <div>₹{fmt(item.igst)}</div>
                        <div style={{ color:"#9E6070", fontSize:9 }}>({item.gstPercent}%)</div>
                      </>
                    )}
                  </td>
                  <td style={{ padding:"6px 8px", textAlign:"right", fontWeight:700, fontSize:11 }}>
                    ₹{fmt(item.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop:"2px solid #6B0F2A" }}>
                <td colSpan={6} style={{ padding:"7px 8px", fontWeight:700, fontSize:11 }}>Total</td>
                <td style={{ padding:"7px 8px", textAlign:"center", fontWeight:700, fontSize:11 }}>
                  {invoiceData.cart.reduce((s, i) => s + i.quantity, 0)}
                </td>
                <td style={{ padding:"7px 8px", textAlign:"right", fontWeight:700, fontSize:11 }}>
                  ₹{fmt(invoiceData.subtotal)}
                </td>
                <td style={{ padding:"7px 8px", textAlign:"right", fontWeight:700, fontSize:11 }}>
                  ₹{fmt(invoiceData.gstTotal)}
                </td>
                <td style={{ padding:"7px 8px", textAlign:"right", fontWeight:800,
                             fontSize:12, color:"#6B0F2A" }}>
                  ₹{fmt(invoiceData.grandTotal + invoiceData.discount)}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* ══ SUMMARY ══ */}
          <div style={{ display:"flex", justifyContent:"space-between", gap:24, marginBottom:16 }}>
            <div style={{ flex:1, background:"#fdf8f4", border:"1px solid #e8ddd5",
                          borderRadius:8, padding:"10px 14px" }}>
              <div style={{ fontWeight:700, fontSize:9, color:"#6B0F2A",
                            textTransform:"uppercase", marginBottom:5 }}>
                Amount In Words
              </div>
              <div style={{ fontWeight:600, fontStyle:"italic", fontSize:11,
                            color:"#3b1c25", lineHeight:1.5 }}>
                {inWords(invoiceData.grandTotal)}
              </div>
              <div style={{ marginTop:10, borderTop:"1px solid #e8ddd5", paddingTop:8 }}>
                <div style={{ fontSize:10, color:"#555" }}>
                  Payment:{" "}
                  <strong style={{ textTransform:"capitalize" }}>{invoiceData.paymentMethod}</strong>
                </div>
                {invoiceData.receivedAmount > 0 && (
                  <div style={{ fontSize:10, color:"#555", marginTop:2 }}>
                    Received: <strong>₹{fmt(invoiceData.receivedAmount)}</strong>
                  </div>
                )}
                {invoiceData.balance !== 0 && (
                  <div style={{ fontSize:10, marginTop:2,
                                color: invoiceData.balance > 0 ? "#16a34a" : "#dc2626" }}>
                    {invoiceData.balance > 0 ? "Change: " : "Balance Due: "}
                    <strong>₹{fmt(Math.abs(invoiceData.balance))}</strong>
                  </div>
                )}
              </div>
            </div>

            <div style={{ minWidth:210 }}>
              {([
                ["Sub Total", `₹${fmt(invoiceData.subtotal)}`],
                ...(invoiceData.gstMode === "intrastate"
                  ? [["CGST", `₹${fmt(invoiceData.cgstTotal)}`], ["SGST", `₹${fmt(invoiceData.sgstTotal)}`]]
                  : [["IGST", `₹${fmt(invoiceData.igstTotal)}`]]),
                ...(invoiceData.discount > 0 ? [["Discount", `-₹${fmt(invoiceData.discount)}`]] : []),
              ] as [string, string][]).map(([l, v]) => (
                <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"3px 0",
                                      borderBottom:"1px dotted #e8ddd5", fontSize:11 }}>
                  <span style={{ color:"#555" }}>{l}</span>
                  <span style={{ color: l === "Discount" ? "#16a34a" : "#1a1a1a" }}>{v}</span>
                </div>
              ))}
              <div style={{ display:"flex", justifyContent:"space-between", background:"#6B0F2A",
                            color:"#F5F0E6", borderRadius:6, padding:"8px 10px", marginTop:6,
                            fontWeight:800, fontSize:13 }}>
                <span>Grand Total</span>
                <span>₹{fmt(invoiceData.grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* ══ FOOTER ══ */}
          <div style={{ borderTop:"1.5px solid #e8ddd5", paddingTop:10, textAlign:"center" }}>
            <span style={{ fontFamily:"Georgia, serif", fontWeight:300, fontSize:16,
                           color:"#6B0F2A", letterSpacing:6, marginRight:8 }}>
              twam
            </span>
            <span style={{ color:"#9E6070", fontSize:10 }}>
              — Thank you for shopping with us! Computer-generated invoice, no signature required.
            </span>
          </div>

        </div>
        {/* ── end invoice content ── */}

      </div>
    </div>
  </div>
)}
      </div>
    </>
  );
}


