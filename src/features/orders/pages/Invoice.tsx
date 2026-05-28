import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getOrderDetail } from "@/features/orders/api/orders.api";
import { formatDate } from "@/shared/utils/helpers";

/* ─── Design tokens ─────────────────────────────────────────── */
const C = {
  burgundy: "#6A012A",
  ivory: "#F6EEE1",
  ivoryDark: "#EDE0CC",
  ivoryMid: "#F0E6D0",
  text: "#2C1018",
  muted: "#9B7080",
};

interface TotalRow {
  label: string;
  value: string;
  green?: boolean;
  muted?: boolean;
}

/* ─────────────────────────────────────────────────────────────
   buildInvoiceHTML
   Generates a fully self-contained A4 HTML page rendered in a
   popup window — completely isolated from the React app so
   Navbar / Footer / min-height wrappers cannot create extra pages.
───────────────────────────────────────────────────────────── */
function buildInvoiceHTML(order: any, id: string | undefined): string {
  const items: any[] = (
    Array.isArray(order.orderItems) ? order.orderItems : []
  ).filter((item: any) => !item.isReturn);

  // GST — prefer top-level fields, fall back to summing line items
  const cgst: number =
    order.cgstTotal ??
    (order.itemsModel ?? []).reduce(
      (s: number, i: any) => s + (i.cgstAmount || 0),
      0,
    );
  const sgst: number =
    order.sgstTotal ??
    (order.itemsModel ?? []).reduce(
      (s: number, i: any) => s + (i.sgstAmount || 0),
      0,
    );

  const subtotal = (order.subTotal || 0).toLocaleString("en-IN");
  const shipping =
    (order.deliveryCharge || 0) === 0
      ? "FREE"
      : `₹${(order.deliveryCharge || 0).toLocaleString("en-IN")}`;
  const total = (order.totalAmount || 0).toLocaleString("en-IN");
  const coupon =
    order.couponAmount > 0 ? order.couponAmount.toLocaleString("en-IN") : null;
  const addr = order.shippingAddress;
  const orderNum = order.orderNumber || id;
  const orderDate = formatDate(order.orderDate || order.createdAt);
  const status = order.state || order.status || "Confirmed";

  const addrLine = addr
    ? [addr.addressLine, addr.locality, addr.city, addr.state, addr.pinCode]
        .filter(Boolean)
        .join(", ")
    : "";

  const itemRows = items
    .map(
      (item) => `
      <tr>
        <td class="td-product">
          ${item.productName || item.name}
          ${
            item.color
              ? `<span class="item-meta">Color: ${item.color}${
                  item.cupSize ? ` · Cup: ${item.cupSize}` : ""
                }</span>`
              : ""
          }
        </td>
        <td>${item.size || "—"}</td>
        <td>${item.quantity}</td>
        <td class="tar">₹${(item.price || 0).toLocaleString("en-IN")}</td>
        <td class="tar">₹${((item.price || 0) * item.quantity).toLocaleString(
          "en-IN",
        )}</td>
      </tr>`,
    )
    .join("");

  // Sub-total rows below items
  const cgstRow =
    cgst > 0
      ? `<tr class="row-sub muted-row"><td colspan="2" class="tal muted upper spaced">CGST (incl. in MRP)</td><td colspan="3" class="tar muted">₹${cgst.toFixed(
          2,
        )}</td></tr>`
      : "";
  const sgstRow =
    sgst > 0
      ? `<tr class="row-sub muted-row"><td colspan="2" class="tal muted upper spaced">SGST (incl. in MRP)</td><td colspan="3" class="tar muted">₹${sgst.toFixed(
          2,
        )}</td></tr>`
      : "";
  const couponRow = coupon
    ? `<tr class="row-sub"><td colspan="2" class="tal muted upper spaced">Coupon Discount</td><td colspan="3" class="tar green">−₹${coupon}</td></tr>`
    : "";

  const logoUrl = `${window.location.origin}/assets/Twam-Logo-White.png`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Invoice — Order #${orderNum}</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;0,700;1,400&display=swap" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    @page { size: A4; margin: 0; }

    html, body {
      width: 210mm;
      height: 297mm;
      overflow: hidden;
      background: #fff;
      font-family: 'EB Garamond', Georgia, serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      color-adjust: exact;
    }

    /* ── Sheet: exactly one A4, flex column ── */
    .sheet {
      width: 210mm;
      height: 297mm;
      display: flex;
      flex-direction: column;
      background: #fff;
      overflow: hidden;
    }

    /* ── Header 2cm ── */
    .hdr {
      height: 20mm; min-height: 20mm; max-height: 20mm;
      background: ${C.burgundy};
      display: flex; align-items: center; justify-content: center;
      position: relative; padding: 0 10mm; flex-shrink: 0;
    }
    .hdr img { height: 11mm; display: block; }
    .hdr-meta { position: absolute; right: 10mm; text-align: right; }
    .hdr-meta .num {
      font-size: 10pt; font-weight: 700; color: ${C.ivory};
      letter-spacing: 0.08em; line-height: 1.4;
    }
    .hdr-meta .dt {
      font-size: 8pt; color: rgba(246,238,225,0.70);
      letter-spacing: 0.10em; line-height: 1.4;
    }

    .accent { height: 2px; background: ${C.ivoryDark}; flex-shrink: 0; }

    /* ── Body ── */
    .body {
      flex: 1; padding: 6mm 10mm 4mm;
      display: flex; flex-direction: column; overflow: hidden;
    }

    /* Title + status row */
    .title-row {
      display: flex; justify-content: space-between; align-items: flex-end;
      padding-bottom: 4mm; border-bottom: 1.5px solid ${
        C.ivoryDark
      }; margin-bottom: 4mm;
    }
    .inv-label  { font-size: 6.5pt; letter-spacing: 0.28em; text-transform: uppercase; color: ${
      C.muted
    }; margin-bottom: 1.5mm; }
    .inv-title  { font-size: 17pt; font-weight: 700; color: ${
      C.text
    }; letter-spacing: 0.04em; }
    .badge      { background: ${C.ivoryMid}; border: 1px solid ${
    C.ivoryDark
  }; border-radius: 2px; padding: 2.5mm 4.5mm; text-align: center; }
    .badge-dot  { width: 6px; height: 6px; border-radius: 50%; background: #2E8B57; margin: 0 auto 1.5mm; }
    .badge-lbl  { font-size: 5.5pt; letter-spacing: 0.22em; text-transform: uppercase; color: ${
      C.muted
    }; }
    .badge-val  { font-size: 7.5pt; font-weight: 600; color: #2E8B57; letter-spacing: 0.12em; text-transform: uppercase; margin-top: 1mm; }

    /* Address */
    .addr-section { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4mm; gap: 16px; }
    .addr-box     { flex: 1; }
    .addr-label   { font-size: 6pt; letter-spacing: 0.28em; text-transform: uppercase; color: ${
      C.muted
    }; margin-bottom: 1.5mm; }
    .addr-name    { font-size: 12pt; font-weight: 700; color: ${
      C.text
    }; letter-spacing: 0.03em; margin-bottom: 1mm; }
    .addr-line    { font-size: 8.5pt; color: #6B5060; line-height: 1.5; }
    .addr-phone   { font-size: 8.5pt; color: ${
      C.muted
    }; margin-top: 1mm; letter-spacing: 0.06em; }

    /* Items table */
    table { width: 100%; border-collapse: collapse; margin-bottom: 0; font-size: 8.5pt; }
    thead tr { background: ${C.burgundy}; }
    thead th {
      font-size: 6pt; letter-spacing: 0.22em; text-transform: uppercase;
      color: rgba(246,238,225,0.75); padding: 2mm 3mm; font-weight: 400;
    }
    thead th.tar { text-align: right; }
    thead th.tal { text-align: left; }
    tbody tr { border-bottom: 1px solid ${C.ivoryMid}; }
    tbody td  { padding: 2mm 3mm; color: #6B5060; vertical-align: top; }
    .td-product   { color: ${C.text}; font-weight: 500; }
    .item-meta    { display: block; font-size: 7pt; color: ${
      C.muted
    }; font-weight: 400; margin-top: 0.3mm; }
    .tar  { text-align: right; }
    .tal  { text-align: left; }
    .muted { color: ${C.muted}; }
    .upper { text-transform: uppercase; letter-spacing: 0.10em; }
    .spaced { letter-spacing: 0.10em; }
    .green { color: #2E8B57; font-weight: 600; }

    /* Summary rows below items (subtotal / gst / shipping / coupon) */
    .row-sub td  { padding: 1.8mm 3mm; font-size: 8pt; border-bottom: 1px solid ${
      C.ivoryMid
    }; }
    .muted-row td { opacity: 0.65; }

    /* Totals block */
    .totals { display: flex; justify-content: flex-end; margin-top: auto; padding-top: 3mm; }
    .totals-box { min-width: 56mm; }
    .total-row {
      display: flex; justify-content: space-between;
      padding: 1.2mm 0; border-bottom: 1px solid ${C.ivoryMid}; gap: 8mm;
    }
    .total-lbl { font-size: 7.5pt; color: ${
      C.muted
    }; letter-spacing: 0.10em; text-transform: uppercase; }
    .total-val { font-size: 8.5pt; color: ${C.text}; }
    .total-val.green { color: #2E8B57; font-weight: 600; }
    .total-val.muted { color: ${C.muted}; opacity: 0.65; }
    .grand-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 2.5mm 4mm;
      background: linear-gradient(135deg, ${C.ivory} 0%, #fff 100%);
      border: 1.5px solid ${C.ivoryDark}; border-left: 4px solid ${C.burgundy};
      border-radius: 2px; margin-top: 2mm; gap: 8mm;
    }
    .grand-lbl { font-size: 7.5pt; letter-spacing: 0.26em; text-transform: uppercase; color: ${
      C.muted
    }; }
    .grand-val { font-size: 15pt; font-weight: 700; color: ${
      C.burgundy
    }; letter-spacing: 0.04em; }

    /* ── Footer 0.5cm ── */
    .ftr {
      height: 10mm; min-height: 10mm; max-height: 10mm;
      background: ${C.burgundy};
      display: flex; align-items: center; justify-content: center;
      gap: 5mm; padding: 0 10mm; flex-shrink: 0;
    }
    .ftr span { font-size: 6pt; color: rgba(246,238,225,0.85); letter-spacing: 0.16em; text-transform: uppercase; }
    .ftr-div  { color: rgba(246,238,225,0.30); font-size: 8pt; }
  </style>
</head>
<body>
<div class="sheet">

  <!-- HEADER 2cm -->
  <div class="hdr">
    <img src="${logoUrl}" alt="TWAM" />
    <div class="hdr-meta">
      <div class="num">Order #${orderNum}</div>
      <div class="dt">${orderDate}</div>
    </div>
  </div>
  <div class="accent"></div>

  <!-- BODY -->
  <div class="body">

    <!-- Title + Status -->
    <div class="title-row">
      <div>
        <div class="inv-label">Tax Invoice</div>
        <div class="inv-title">Invoice</div>
      </div>
      <div class="badge">
        <div class="badge-dot"></div>
        <div class="badge-lbl">Status</div>
        <div class="badge-val">${status}</div>
      </div>
    </div>

    <!-- Address -->
    ${
      addr
        ? `<div class="addr-section">
      <div class="addr-box">
        <div class="addr-label">Bill / Ship To</div>
        <div class="addr-name">${addr.name || ""}</div>
        <div class="addr-line">${addrLine}</div>
        ${addr.phone ? `<div class="addr-phone">${addr.phone}</div>` : ""}
      </div>
    </div>`
        : ""
    }

    <!-- Items table -->
    <table>
      <thead>
        <tr>
          <th class="tal" style="width:44%">Product</th>
          <th class="tal" style="width:11%">Size</th>
          <th class="tal" style="width:8%">Qty</th>
          <th class="tar" style="width:18%">Price</th>
          <th class="tar" style="width:19%">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
        <!-- Subtotal -->
        <tr class="row-sub">
          <td colspan="2" class="tal muted upper">Subtotal</td>
          <td colspan="3" class="tar">₹${subtotal}</td>
        </tr>
        <!-- CGST / SGST (muted, informational) -->
        ${cgstRow}
        ${sgstRow}
        <!-- Shipping -->
        <tr class="row-sub">
          <td colspan="2" class="tal muted upper">Shipping</td>
          <td colspan="3" class="tar">${shipping}</td>
        </tr>
        <!-- Coupon -->
        ${couponRow}
      </tbody>
    </table>

    <!-- Grand total -->
    <div class="totals">
      <div class="totals-box">
        <div class="grand-row">
          <span class="grand-lbl">Total</span>
          <span class="grand-val">₹${total}</span>
        </div>
      </div>
    </div>

  </div><!-- /body -->

  <div class="accent"></div>

  <!-- FOOTER 0.5cm -->
  <div class="ftr">
    <span>www.onlytwam.com</span>
    <span class="ftr-div">|</span>
    <span>Customer Support: onlytwam.com/contact-us</span>
  </div>

</div>
</body>
</html>`;
}

/* ─── Component ─────────────────────────────────────────────── */
export default function Invoice() {
  const { id } = useParams<{ id: string }>();

  const { data: order, isLoading } = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => getOrderDetail(Number(id)),
    enabled: !!id,
  });

  function handlePrint() {
    if (!order) return;
    const html = buildInvoiceHTML(order, id);
    const popup = window.open("", "_blank", "width=900,height=700");
    if (!popup) return;
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    popup.onload = () => {
      setTimeout(() => {
        popup.focus();
        popup.print();
      }, 600);
    };
    // Fallback if onload already fired
    setTimeout(() => {
      popup.focus();
      popup.print();
    }, 1200);
  }

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'EB Garamond', Georgia, serif",
        }}
      >
        <span
          style={{ color: C.burgundy, letterSpacing: "0.18em", fontSize: 13 }}
        >
          LOADING INVOICE…
        </span>
      </div>
    );
  }

  if (!order) {
    return (
      <div
        style={{
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'EB Garamond', Georgia, serif",
        }}
      >
        <span style={{ color: C.muted, letterSpacing: "0.12em", fontSize: 13 }}>
          Invoice not found.
        </span>
      </div>
    );
  }

  const items: any[] = (
    Array.isArray(order.orderItems) ? order.orderItems : []
  ).filter((item: any) => !item.isReturn);

  // GST — prefer top-level fields, fall back to summing line items
  const invoiceCgst: number =
    order.cgstTotal ??
    (order.itemsModel ?? []).reduce(
      (s: number, i: any) => s + (i.cgstAmount || 0),
      0,
    );
  const invoiceSgst: number =
    order.sgstTotal ??
    (order.itemsModel ?? []).reduce(
      (s: number, i: any) => s + (i.sgstAmount || 0),
      0,
    );

  const totals: TotalRow[] = [
    {
      label: "Subtotal",
      value: `₹${(order.subTotal || 0).toLocaleString("en-IN")}`,
    },
    ...(invoiceCgst > 0
      ? [
          {
            label: "CGST (incl. in MRP)",
            value: `₹${invoiceCgst.toFixed(2)}`,
            muted: true,
          },
        ]
      : []),
    ...(invoiceSgst > 0
      ? [
          {
            label: "SGST (incl. in MRP)",
            value: `₹${invoiceSgst.toFixed(2)}`,
            muted: true,
          },
        ]
      : []),
    {
      label: "Shipping",
      value:
        (order.deliveryCharge || 0) === 0
          ? "FREE"
          : `₹${(order.deliveryCharge || 0).toLocaleString("en-IN")}`,
    },
    ...(order.couponAmount > 0
      ? [
          {
            label: "Coupon Discount",
            value: `−₹${order.couponAmount.toLocaleString("en-IN")}`,
            green: true,
          },
        ]
      : []),
  ];

  const addr = order.shippingAddress;

  /* ── Screen preview ─────────────────────────────────────── */
  return (
    <div
      style={{
        background: C.ivory,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "32px 16px 56px",
        fontFamily: "'EB Garamond', Georgia, serif",
      }}
    >
      {/* Action buttons */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 24,
          width: "100%",
          maxWidth: 794,
        }}
      >
        <button
          onClick={handlePrint}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 24px",
            background: C.burgundy,
            color: C.ivory,
            border: "none",
            borderRadius: 2,
            cursor: "pointer",
            fontSize: 12,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            fontFamily: "'EB Garamond', Georgia, serif",
            fontWeight: 600,
          }}
          onMouseOver={(e) => (e.currentTarget.style.opacity = "0.85")}
          onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          Download / Print
        </button>
        <Link
          to="/account/orders-list"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 24px",
            background: "transparent",
            color: C.burgundy,
            border: `1.5px solid ${C.burgundy}`,
            borderRadius: 2,
            fontSize: 12,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            fontFamily: "'EB Garamond', Georgia, serif",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          ← Back to Orders
        </Link>
      </div>

      {/* Screen preview card */}
      <div
        style={{
          width: "100%",
          maxWidth: 794,
          background: "#fff",
          boxShadow: `0 2px 0 ${C.burgundy}, 0 12px 48px rgba(106,1,42,0.12)`,
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            height: 76,
            background: C.burgundy,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            padding: "0 32px",
          }}
        >
          <img
            src="/assets/Twam-Logo-White.png"
            alt="TWAM"
            style={{ height: 38 }}
          />
          <div style={{ position: "absolute", right: 32, textAlign: "right" }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: C.ivory,
                letterSpacing: "0.08em",
                lineHeight: 1.4,
              }}
            >
              Order #{order.orderNumber || id}
            </div>
            <div
              style={{
                fontSize: 10,
                color: "rgba(246,238,225,0.70)",
                letterSpacing: "0.10em",
                lineHeight: 1.4,
              }}
            >
              {formatDate(order.orderDate || order.createdAt)}
            </div>
          </div>
        </div>

        <div style={{ height: 3, background: C.ivoryDark }} />

        {/* Body */}
        <div style={{ padding: "28px 40px 24px" }}>
          {/* Title + Status */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              paddingBottom: 16,
              borderBottom: `1.5px solid ${C.ivoryDark}`,
              marginBottom: 20,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 9,
                  letterSpacing: "0.30em",
                  textTransform: "uppercase",
                  color: C.muted,
                  marginBottom: 4,
                }}
              >
                Tax Invoice
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: C.text,
                  letterSpacing: "0.04em",
                }}
              >
                Invoice
              </div>
            </div>
            <div
              style={{
                background: C.ivoryMid,
                border: `1px solid ${C.ivoryDark}`,
                borderRadius: 2,
                padding: "6px 16px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#2E8B57",
                  margin: "0 auto 3px",
                }}
              />
              <div
                style={{
                  fontSize: 8,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: C.muted,
                }}
              >
                Status
              </div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "#2E8B57",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  marginTop: 2,
                }}
              >
                {order.state || order.status || "Confirmed"}
              </div>
            </div>
          </div>

          {/* Address */}
          {addr && (
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: 8,
                  letterSpacing: "0.28em",
                  textTransform: "uppercase",
                  color: C.muted,
                  marginBottom: 6,
                }}
              >
                Bill / Ship To
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: C.text,
                  marginBottom: 4,
                }}
              >
                {addr.name}
              </div>
              <div style={{ fontSize: 12, color: "#6B5060", lineHeight: 1.65 }}>
                {[
                  addr.addressLine,
                  addr.locality,
                  addr.city,
                  addr.state,
                  addr.pinCode,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </div>
              {addr.phone && (
                <div
                  style={{
                    fontSize: 12,
                    color: C.muted,
                    marginTop: 4,
                    letterSpacing: "0.06em",
                  }}
                >
                  {addr.phone}
                </div>
              )}
            </div>
          )}

          {/* Items table */}
          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 72px 52px 90px 90px",
                padding: "8px 14px",
                background: C.burgundy,
                borderRadius: 2,
                marginBottom: 2,
              }}
            >
              {["Product", "Size", "Qty", "Price", "Total"].map((h, i) => (
                <span
                  key={h}
                  style={{
                    fontSize: 8,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: "rgba(246,238,225,0.75)",
                    textAlign: i >= 3 ? "right" : "left",
                  }}
                >
                  {h}
                </span>
              ))}
            </div>
            {items.map((item, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 72px 52px 90px 90px",
                  padding: "12px 14px",
                  borderBottom: `1px solid ${C.ivoryMid}`,
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>
                  {item.productName || item.name}
                  {item.color && (
                    <span
                      style={{
                        display: "block",
                        fontSize: 10,
                        color: C.muted,
                        fontWeight: 400,
                        marginTop: 2,
                      }}
                    >
                      Color: {item.color}
                      {item.cupSize ? ` · Cup: ${item.cupSize}` : ""}
                    </span>
                  )}
                </span>
                <span style={{ fontSize: 12, color: "#6B5060" }}>
                  {item.size || "—"}
                </span>
                <span style={{ fontSize: 12, color: "#6B5060" }}>
                  {item.quantity}
                </span>
                <span
                  style={{ fontSize: 12, color: "#6B5060", textAlign: "right" }}
                >
                  ₹{(item.price || 0).toLocaleString("en-IN")}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    color: C.text,
                    fontWeight: 600,
                    textAlign: "right",
                  }}
                >
                  ₹{((item.price || 0) * item.quantity).toLocaleString("en-IN")}
                </span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <div style={{ minWidth: 280 }}>
              {totals.map(({ label, value, green, muted }: TotalRow) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "6px 0",
                    borderBottom: `1px solid ${C.ivoryMid}`,
                    gap: 40,
                    opacity: muted ? 0.65 : 1,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: C.muted,
                      letterSpacing: "0.10em",
                      textTransform: "uppercase",
                    }}
                  >
                    {label}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: green ? "#2E8B57" : C.text,
                      fontWeight: green ? 600 : 400,
                    }}
                  >
                    {value}
                  </span>
                </div>
              ))}
              {/* Grand total */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 14px",
                  background: `linear-gradient(135deg, ${C.ivory} 0%, #fff 100%)`,
                  border: `1.5px solid ${C.ivoryDark}`,
                  borderLeft: `5px solid ${C.burgundy}`,
                  borderRadius: 2,
                  marginTop: 8,
                  gap: 40,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.26em",
                    textTransform: "uppercase",
                    color: C.muted,
                  }}
                >
                  Total
                </span>
                <span
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: C.burgundy,
                    letterSpacing: "0.04em",
                  }}
                >
                  ₹{(order.totalAmount || 0).toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ height: 2, background: C.ivoryDark }} />

        {/* Footer */}
        <div
          style={{
            height: 38,
            background: C.burgundy,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 24,
            padding: "0 32px",
          }}
        >
          <span
            style={{
              fontSize: 9,
              color: "rgba(246,238,225,0.85)",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            www.onlytwam.com
          </span>
          <span style={{ color: "rgba(246,238,225,0.30)", fontSize: 10 }}>
            |
          </span>
          <span
            style={{
              fontSize: 9,
              color: "rgba(246,238,225,0.85)",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            Customer Support: onlytwam.com/contact-us
          </span>
        </div>
      </div>
    </div>
  );
}
