// InvoicePrint.tsx
// Drop-in replacement — paste this file and remove the local stub from AdminBilling.tsx
// Usage: import InvoicePrint from "./InvoicePrint";

import type { CartItem, GSTMode, PaymentMethod } from "../utils/billingUtils";
import { fmt, inWords } from "../utils/billingUtils";

export interface InvoicePrintProps {
  invoiceNo:      string;
  date:           string;
  customerName:   string;
  customerPhone:  string;
  storeName:      string;
  storeAddress:   string;
  storeGSTIN:     string;
  cart:           CartItem[];
  subtotal:       number;
  gstTotal:       number;
  discount:       number;
  grandTotal:     number;
  cgstTotal:      number;
  sgstTotal:      number;
  igstTotal:      number;
  gstMode:        GSTMode;
  paymentMethod:  PaymentMethod;
  receivedAmount: number;
  balance:        number;
}

const s = {
  burgundy: "#6B0F2A",
  rose:     "#9E6070",
  ivory:    "#F5F0E6",
  muted:    "#555555",
  light:    "#e8ddd5",
};

function Row({ label, value, bold, green }: {
  label: string; value: string; bold?: boolean; green?: boolean;
}) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", padding:"3px 0",
                  borderBottom:`1px dotted ${s.light}`, fontSize:11 }}>
      <span style={{ color:s.muted }}>{label}</span>
      <span style={{ color: green ? "#16a34a" : "#1a1a1a", fontWeight: bold ? 700 : 400 }}>
        {value}
      </span>
    </div>
  );
}

export default function InvoicePrint(props: InvoicePrintProps) {
  const {
    invoiceNo, date, customerName, customerPhone,
    storeName, storeAddress, storeGSTIN,
    cart, subtotal, gstTotal, discount, grandTotal,
    cgstTotal, sgstTotal, igstTotal,
    gstMode, paymentMethod, receivedAmount, balance,
  } = props;

  const totalQty = cart.reduce((acc, i) => acc + i.quantity, 0);

  return (
    <div style={{ fontFamily:"Arial,sans-serif", background:"#fff", color:"#1a1a1a",
                  padding:"24px 28px", maxWidth:740, margin:"0 auto", fontSize:12 }}>

      {/* ══════════════ HEADER ══════════════ */}
      <div style={{ textAlign:"center", borderBottom:`2.5px solid ${s.burgundy}`,
                    paddingBottom:14, marginBottom:14 }}>

        {/* ── twam brand name ── */}
        <div style={{ fontSize:36, fontWeight:300, color:s.burgundy,
                      letterSpacing:8, fontFamily:"Georgia, serif" }}>
          twam
        </div>

        {/* ── Store / warehouse name ── */}
        <div style={{ fontSize:14, fontWeight:700, color:"#1a1a1a",
                      letterSpacing:0.5, marginTop:6 }}>
          {storeName}
        </div>

        {/* ── Dynamic address ── */}
        {storeAddress && (
          <div style={{ color:s.muted, fontSize:11, marginTop:3 }}>
            {storeAddress}
          </div>
        )}

        <div style={{ color:s.muted, fontSize:11, marginTop:3 }}>
          GSTIN: <strong>{storeGSTIN}</strong>
        </div>
      </div>

      {/* ══════════════ TITLE ══════════════ */}
      <div style={{ textAlign:"center", marginBottom:14 }}>
        <div style={{ fontSize:14, fontWeight:700, letterSpacing:3,
                      color:s.burgundy, textTransform:"uppercase" }}>
          Tax Invoice
        </div>
      </div>

      {/* ══════════════ BILL TO / INVOICE DETAILS ══════════════ */}
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:14 }}>
        <div>
          <div style={{ fontWeight:700, fontSize:10, color:s.burgundy,
                        textTransform:"uppercase", letterSpacing:.5, marginBottom:4 }}>
            Bill To
          </div>
          <div style={{ fontWeight:700, fontSize:13 }}>
            {customerName || "Walk-in Customer"}
          </div>
          {customerPhone && (
            <div style={{ color:s.muted, marginTop:2 }}>📞 {customerPhone}</div>
          )}
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontWeight:700, fontSize:10, color:s.burgundy,
                        textTransform:"uppercase", letterSpacing:.5, marginBottom:4 }}>
            Invoice Details
          </div>
          <div style={{ color:s.muted }}>
            Invoice No: <strong style={{ color:s.burgundy }}>{invoiceNo}</strong>
          </div>
          <div style={{ color:s.muted, marginTop:2 }}>
            Date: <strong>{date}</strong>
          </div>
          <div style={{ color:s.muted, marginTop:2, textTransform:"capitalize" }}>
            Payment: <strong>{paymentMethod}</strong>
          </div>
        </div>
      </div>

      {/* ══════════════ ITEMS TABLE ══════════════ */}
      <table style={{ width:"100%", borderCollapse:"collapse", marginBottom:14 }}>
        <thead>
          <tr style={{ background:s.burgundy }}>
            {["#","Product","Size","Color","HSN","Qty","Rate",
              gstMode === "intrastate" ? "CGST+SGST" : "IGST",
              "Amount",
            ].map((h, i) => (
              <th key={i} style={{
                padding:"7px 8px", color:s.ivory, fontSize:10, fontWeight:700,
                textAlign: ["Rate","CGST+SGST","IGST","Amount"].includes(h)
                  ? "right" : (h === "#" || h === "Qty") ? "center" : "left",
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cart.map((item, i) => (
            <tr key={item.cartId} style={{ background: i % 2 === 0 ? "#fff" : "#fdf8f4" }}>
              <td style={{ padding:"6px 8px", textAlign:"center", fontSize:11 }}>{i + 1}</td>
              <td style={{ padding:"6px 8px", fontWeight:700, fontSize:11 }}>
                {item.productName}
                <div style={{ fontFamily:"monospace", fontSize:9, color:s.rose, fontWeight:400 }}>
                  {item.stockId}
                </div>
              </td>
              <td style={{ padding:"6px 8px", fontSize:11 }}>{item.size}</td>
              <td style={{ padding:"6px 8px", fontSize:11 }}>{item.color}</td>
              <td style={{ padding:"6px 8px", fontSize:10, color:s.muted }}>{item.hsnCode}</td>
              <td style={{ padding:"6px 8px", textAlign:"center", fontSize:11 }}>{item.quantity}</td>
              <td style={{ padding:"6px 8px", textAlign:"right", fontSize:11 }}>₹{fmt(item.price)}</td>
              <td style={{ padding:"6px 8px", textAlign:"right", fontSize:11 }}>
                {gstMode === "intrastate" ? (
                  <>
                    <div>₹{fmt(item.cgst)}</div>
                    <div style={{ color:s.rose, fontSize:9 }}>
                      ({item.gstPercent / 2}%+{item.gstPercent / 2}%)
                    </div>
                  </>
                ) : (
                  <>
                    <div>₹{fmt(item.igst)}</div>
                    <div style={{ color:s.rose, fontSize:9 }}>({item.gstPercent}%)</div>
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
          <tr style={{ borderTop:`2px solid ${s.burgundy}` }}>
            <td colSpan={5} style={{ padding:"7px 8px", fontWeight:700, fontSize:11 }}>Total</td>
            <td style={{ padding:"7px 8px", textAlign:"center", fontWeight:700, fontSize:11 }}>
              {totalQty}
            </td>
            <td style={{ padding:"7px 8px", textAlign:"right", fontWeight:700, fontSize:11 }}>
              ₹{fmt(subtotal)}
            </td>
            <td style={{ padding:"7px 8px", textAlign:"right", fontWeight:700, fontSize:11 }}>
              ₹{fmt(gstTotal)}
            </td>
            <td style={{ padding:"7px 8px", textAlign:"right", fontWeight:800,
                         fontSize:12, color:s.burgundy }}>
              ₹{fmt(grandTotal + discount)}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* ══════════════ SUMMARY + AMOUNT IN WORDS ══════════════ */}
      <div style={{ display:"flex", justifyContent:"space-between", gap:24, marginBottom:16 }}>
        <div style={{ flex:1, background:"#fdf8f4", border:`1px solid ${s.light}`,
                      borderRadius:8, padding:"10px 14px" }}>
          <div style={{ fontWeight:700, fontSize:9, color:s.burgundy,
                        textTransform:"uppercase", marginBottom:5 }}>
            Amount In Words
          </div>
          <div style={{ fontWeight:600, fontStyle:"italic", fontSize:11,
                        color:"#3b1c25", lineHeight:1.5 }}>
            {inWords(grandTotal)}
          </div>
          <div style={{ marginTop:10, borderTop:`1px solid ${s.light}`, paddingTop:8 }}>
            <div style={{ fontSize:10, color:s.muted, textTransform:"capitalize" }}>
              Payment: <strong>{paymentMethod}</strong>
            </div>
            {receivedAmount > 0 && (
              <div style={{ fontSize:10, color:s.muted, marginTop:2 }}>
                Received: <strong>₹{fmt(receivedAmount)}</strong>
              </div>
            )}
            {balance !== 0 && (
              <div style={{ fontSize:10, marginTop:2,
                            color: balance > 0 ? "#16a34a" : "#dc2626" }}>
                {balance > 0 ? "Change: " : "Balance Due: "}
                <strong>₹{fmt(Math.abs(balance))}</strong>
              </div>
            )}
          </div>
        </div>

        <div style={{ minWidth:210 }}>
          <Row label="Sub Total" value={`₹${fmt(subtotal)}`} />
          {gstMode === "intrastate" ? (
            <>
              <Row label="CGST" value={`₹${fmt(cgstTotal)}`} />
              <Row label="SGST" value={`₹${fmt(sgstTotal)}`} />
            </>
          ) : (
            <Row label="IGST" value={`₹${fmt(igstTotal)}`} />
          )}
          {discount > 0 && (
            <Row label="Discount" value={`-₹${fmt(discount)}`} green />
          )}
          <div style={{ display:"flex", justifyContent:"space-between",
                        background:s.burgundy, color:s.ivory,
                        borderRadius:6, padding:"8px 10px", marginTop:6,
                        fontWeight:800, fontSize:13 }}>
            <span>Grand Total</span>
            <span>₹{fmt(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* ══════════════ HSN SUMMARY ══════════════ */}
      {(() => {
        const hsnMap: Record<string, {
          taxable: number; cgst: number; sgst: number; igst: number; gst: number;
        }> = {};
        cart.forEach(item => {
          const key = `${item.hsnCode}|${item.gstPercent}`;
          if (!hsnMap[key]) hsnMap[key] = { taxable:0, cgst:0, sgst:0, igst:0, gst:0 };
          hsnMap[key].taxable += item.subtotal;
          hsnMap[key].cgst    += item.cgst;
          hsnMap[key].sgst    += item.sgst;
          hsnMap[key].igst    += item.igst;
          hsnMap[key].gst     += item.gstAmount;
        });
        const rows = Object.entries(hsnMap);
        if (!rows.length) return null;
        return (
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:9, fontWeight:700, color:s.burgundy,
                          textTransform:"uppercase", marginBottom:6, letterSpacing:.5 }}>
              HSN / SAC Summary
            </div>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10 }}>
              <thead>
                <tr style={{ background:"#f0e8e4" }}>
                  {["HSN","GST%","Taxable","CGST","SGST","IGST","Total Tax"].map(h => (
                    <th key={h} style={{
                      padding:"5px 7px", fontWeight:700, color:"#3b1c25",
                      textAlign: (h === "HSN" || h === "GST%") ? "left" : "right" as any,
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(([key, v]) => {
                  const [hsn, pct] = key.split("|");
                  return (
                    <tr key={key} style={{ borderBottom:`1px solid ${s.light}` }}>
                      <td style={{ padding:"5px 7px" }}>{hsn || "—"}</td>
                      <td style={{ padding:"5px 7px" }}>{pct}%</td>
                      <td style={{ padding:"5px 7px", textAlign:"right" }}>₹{fmt(v.taxable)}</td>
                      <td style={{ padding:"5px 7px", textAlign:"right" }}>₹{fmt(v.cgst)}</td>
                      <td style={{ padding:"5px 7px", textAlign:"right" }}>₹{fmt(v.sgst)}</td>
                      <td style={{ padding:"5px 7px", textAlign:"right" }}>₹{fmt(v.igst)}</td>
                      <td style={{ padding:"5px 7px", textAlign:"right", fontWeight:700 }}>
                        ₹{fmt(v.gst)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })()}

      {/* ══════════════ FOOTER ══════════════ */}
      <div style={{ borderTop:`1.5px solid ${s.light}`, paddingTop:10, textAlign:"center" }}>
        <span style={{ fontFamily:"Georgia, serif", fontWeight:300, fontSize:16,
                       color:s.burgundy, letterSpacing:6, marginRight:8 }}>
          twam
        </span>
        <span style={{ color:s.rose, fontSize:10 }}>
          — Thank you for shopping with us! Computer-generated invoice, no signature required.
        </span>
      </div>

    </div>
  );
}