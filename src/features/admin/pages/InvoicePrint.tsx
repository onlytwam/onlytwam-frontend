// InvoicePrint.tsx
import type { CartItem, GSTMode, PaymentMethod } from "../utils/billingUtils";
import { fmt, inWords } from "../utils/billingUtils";

export interface InvoicePrintProps {
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
    <div style={{
      display: "flex", justifyContent: "space-between",
      padding: "4px 0", borderBottom: `1px dotted ${s.light}`, fontSize: 11,
    }}>
      <span style={{ color: s.muted }}>{label}</span>
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
    <>
      <style>{`
        @page {
          size: A4;
          margin: 12mm 14mm;
        }
        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          body {
            margin: 0;
            padding: 0;
          }
          .invoice-root {
            box-shadow: none !important;
            border: none !important;
          }
        }
        .invoice-root {
          font-family: Arial, sans-serif;
          background: #fff;
          color: #1a1a1a;
          font-size: 12px;
          max-width: 720px;
          margin: 0 auto;
          padding: 28px 32px;
          box-sizing: border-box;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }
        .invoice-body {
          flex: 1;
        }
        table.items-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 16px;
        }
        table.items-table thead tr {
          background: #6B0F2A;
        }
        table.items-table thead th {
          padding: 7px 8px;
          color: #F5F0E6;
          font-size: 10px;
          font-weight: 700;
        }
        table.items-table tbody tr:nth-child(even) {
          background: #fdf8f4;
        }
        table.items-table tbody tr:nth-child(odd) {
          background: #fff;
        }
        table.items-table tbody td {
          padding: 7px 8px;
          font-size: 11px;
          border-bottom: 1px solid #e8ddd5;
        }
        table.items-table tfoot tr {
          border-top: 2px solid #6B0F2A;
        }
        table.items-table tfoot td {
          padding: 7px 8px;
          font-weight: 700;
          font-size: 11px;
        }
        table.hsn-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10px;
        }
        table.hsn-table thead tr {
          background: #f0e8e4;
        }
        table.hsn-table thead th {
          padding: 5px 7px;
          font-weight: 700;
          color: #3b1c25;
        }
        table.hsn-table tbody tr {
          border-bottom: 1px solid #e8ddd5;
        }
        table.hsn-table tbody td {
          padding: 5px 7px;
        }
      `}</style>

      <div className="invoice-root">
        <div className="invoice-body">

          {/* ══════════════ HEADER ══════════════ */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "flex-start",
            borderBottom: `2.5px solid ${s.burgundy}`, paddingBottom: 16, marginBottom: 16,
          }}>
            {/* Left: Brand */}
            <div>
              <div style={{
                fontSize: 38, fontWeight: 300, color: s.burgundy,
                letterSpacing: 10, fontFamily: "Georgia, serif", lineHeight: 1,
              }}>
                twam
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", marginTop: 6 }}>
                {storeName}
              </div>
              {storeAddress && (
                <div style={{ color: s.muted, fontSize: 10, marginTop: 2, maxWidth: 260 }}>
                  {storeAddress}
                </div>
              )}
              <div style={{ color: s.muted, fontSize: 10, marginTop: 2 }}>
                GSTIN: <strong>{storeGSTIN}</strong>
              </div>
            </div>

            {/* Right: Invoice label + number */}
            <div style={{ textAlign: "right" }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: s.muted,
                textTransform: "uppercase", letterSpacing: 2, marginBottom: 4,
              }}>
                Tax Invoice
              </div>
              <div style={{
                fontSize: 22, fontWeight: 800, color: s.burgundy, letterSpacing: 1,
              }}>
                #{invoiceNo}
              </div>
              <div style={{ color: s.muted, fontSize: 11, marginTop: 4 }}>
                Date: <strong style={{ color: "#1a1a1a" }}>{date}</strong>
              </div>
              <div style={{ color: s.muted, fontSize: 11, marginTop: 2, textTransform: "capitalize" }}>
                Payment: <strong style={{ color: "#1a1a1a" }}>{paymentMethod}</strong>
              </div>
            </div>
          </div>

          {/* ══════════════ BILL TO ══════════════ */}
          <div style={{
            background: "#fdf8f4", border: `1px solid ${s.light}`,
            borderRadius: 6, padding: "10px 14px", marginBottom: 16,
          }}>
            <div style={{
              fontWeight: 700, fontSize: 9, color: s.burgundy,
              textTransform: "uppercase", letterSpacing: 1, marginBottom: 6,
            }}>
              Bill To
            </div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>
              {customerName || "Walk-in Customer"}
            </div>
            {customerPhone && (
              <div style={{ color: s.muted, fontSize: 11, marginTop: 3 }}>
                📞 {customerPhone}
              </div>
            )}
          </div>

          {/* ══════════════ ITEMS TABLE ══════════════ */}
          <table className="items-table">
            <thead>
              <tr>
                {["#", "Product", "Size", "Color", "HSN", "Qty", "Rate",
                  gstMode === "intrastate" ? "CGST+SGST" : "IGST",
                  "Amount",
                ].map((h, i) => (
                  <th key={i} style={{
                    textAlign: ["Rate", "CGST+SGST", "IGST", "Amount"].includes(h)
                      ? "right" : (h === "#" || h === "Qty") ? "center" : "left",
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cart.map((item, i) => (
                <tr key={item.cartId}>
                  <td style={{ textAlign: "center" }}>{i + 1}</td>
                  <td style={{ fontWeight: 700 }}>
                    {item.productName}
                    <div style={{
                      fontFamily: "monospace", fontSize: 9,
                      color: s.rose, fontWeight: 400, marginTop: 2,
                    }}>
                      {item.stockId}
                    </div>
                  </td>
                  <td>{item.size}</td>
                  <td>{item.color}</td>
                  <td style={{ color: s.muted, fontSize: 10 }}>{item.hsnCode}</td>
                  <td style={{ textAlign: "center" }}>{item.quantity}</td>
                  <td style={{ textAlign: "right" }}>₹{fmt(item.price)}</td>
                  <td style={{ textAlign: "right" }}>
                    {gstMode === "intrastate" ? (
                      <>
                        <div>₹{fmt(item.cgst)}</div>
                        <div style={{ color: s.rose, fontSize: 9 }}>
                          ({item.gstPercent / 2}%+{item.gstPercent / 2}%)
                        </div>
                      </>
                    ) : (
                      <>
                        <div>₹{fmt(item.igst)}</div>
                        <div style={{ color: s.rose, fontSize: 9 }}>({item.gstPercent}%)</div>
                      </>
                    )}
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>
                    ₹{fmt(item.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5}>Total</td>
                <td style={{ textAlign: "center" }}>{totalQty}</td>
                <td style={{ textAlign: "right" }}>₹{fmt(subtotal)}</td>
                <td style={{ textAlign: "right" }}>₹{fmt(gstTotal)}</td>
                <td style={{ textAlign: "right", fontSize: 12, color: s.burgundy, fontWeight: 800 }}>
                  ₹{fmt(grandTotal + discount)}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* ══════════════ SUMMARY ══════════════ */}
          <div style={{
            display: "flex", justifyContent: "flex-end",
            gap: 24, marginBottom: 16, alignItems: "flex-start",
          }}>
            {/* Amount in Words — left-aligned block */}
            <div style={{
              flex: 1, background: "#fdf8f4", border: `1px solid ${s.light}`,
              borderRadius: 6, padding: "10px 14px", alignSelf: "stretch",
              display: "flex", flexDirection: "column", justifyContent: "center",
            }}>
              <div style={{
                fontWeight: 700, fontSize: 9, color: s.burgundy,
                textTransform: "uppercase", letterSpacing: 1, marginBottom: 4,
              }}>
                Amount In Words
              </div>
              <div style={{
                fontWeight: 600, fontStyle: "italic", fontSize: 11,
                color: "#3b1c25", lineHeight: 1.6,
              }}>
                {inWords(grandTotal)}
              </div>
              <div style={{ marginTop: 8, borderTop: `1px solid ${s.light}`, paddingTop: 8 }}>
                <div style={{ fontSize: 10, color: s.muted, textTransform: "capitalize" }}>
                  Payment: <strong>{paymentMethod}</strong>
                </div>
                {receivedAmount > 0 && (
                  <div style={{ fontSize: 10, color: s.muted, marginTop: 2 }}>
                    Received: <strong>₹{fmt(receivedAmount)}</strong>
                  </div>
                )}
                {balance !== 0 && (
                  <div style={{
                    fontSize: 10, marginTop: 2,
                    color: balance > 0 ? "#16a34a" : "#dc2626",
                  }}>
                    {balance > 0 ? "Change: " : "Balance Due: "}
                    <strong>₹{fmt(Math.abs(balance))}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* Totals breakdown */}
            <div style={{ minWidth: 220 }}>
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
              <div style={{
                display: "flex", justifyContent: "space-between",
                background: s.burgundy, color: s.ivory,
                borderRadius: 6, padding: "10px 12px", marginTop: 8,
                fontWeight: 800, fontSize: 14,
              }}>
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
              if (!hsnMap[key]) hsnMap[key] = { taxable: 0, cgst: 0, sgst: 0, igst: 0, gst: 0 };
              hsnMap[key].taxable += item.subtotal;
              hsnMap[key].cgst    += item.cgst;
              hsnMap[key].sgst    += item.sgst;
              hsnMap[key].igst    += item.igst;
              hsnMap[key].gst     += item.gstAmount;
            });
            const rows = Object.entries(hsnMap);
            if (!rows.length) return null;
            return (
              <div style={{ marginBottom: 16 }}>
                <div style={{
                  fontSize: 9, fontWeight: 700, color: s.burgundy,
                  textTransform: "uppercase", marginBottom: 6, letterSpacing: .5,
                }}>
                  HSN / SAC Summary
                </div>
                <table className="hsn-table">
                  <thead>
                    <tr>
                      {["HSN", "GST%", "Taxable", "CGST", "SGST", "IGST", "Total Tax"].map(h => (
                        <th key={h} style={{
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
                        <tr key={key}>
                          <td>{hsn || "—"}</td>
                          <td>{pct}%</td>
                          <td style={{ textAlign: "right" }}>₹{fmt(v.taxable)}</td>
                          <td style={{ textAlign: "right" }}>₹{fmt(v.cgst)}</td>
                          <td style={{ textAlign: "right" }}>₹{fmt(v.sgst)}</td>
                          <td style={{ textAlign: "right" }}>₹{fmt(v.igst)}</td>
                          <td style={{ textAlign: "right", fontWeight: 700 }}>₹{fmt(v.gst)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}

        </div>{/* end invoice-body */}

        {/* ══════════════ FOOTER ══════════════ */}
        <div style={{
          borderTop: `1.5px solid ${s.light}`, paddingTop: 12,
          marginTop: 8, textAlign: "center",
        }}>
          <span style={{
            fontFamily: "Georgia, serif", fontWeight: 300, fontSize: 18,
            color: s.burgundy, letterSpacing: 7, marginRight: 8,
          }}>
            Twam
          </span>
          <span style={{ color: s.rose, fontSize: 10 }}>
            — Thank you for shopping with us! Computer-generated invoice, no signature required.
          </span>
        </div>

      </div>
    </>
  );
}