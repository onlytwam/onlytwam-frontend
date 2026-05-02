import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getOrderDetail } from '@/features/orders/api/orders.api';
import { formatDate } from '@/shared/utils/helpers';

/* ─── Design tokens ─────────────────────────────────────────── */
const C = {
  burgundy:  '#6A012A',
  ivory:     '#F6EEE1',
  ivoryDark: '#EDE0CC',
  ivoryMid:  '#F0E6D0',
  text:      '#2C1018',
  muted:     '#9B7080',
};

/* ─── Types ──────────────────────────────────────────────────── */
interface TotalRow {
  label: string;
  value: string;
  green?: boolean;
}

/* ─── Inline styles ──────────────────────────────────────────── */
const styles: Record<string, React.CSSProperties> = {
  page: {
    background: C.ivory,
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '48px 16px 64px',
    fontFamily: "'EB Garamond', 'Georgia', serif",
  },
  card: {
    background: '#fff',
    maxWidth: 720,
    width: '100%',
    borderRadius: 2,
    overflow: 'hidden',
    boxShadow: `0 2px 0 ${C.burgundy}, 0 12px 48px rgba(106,1,42,0.10)`,
  },
  accentBar: {
    height: 5,
    background: C.burgundy,
  },
  headerBand: {
    background: C.burgundy,
    padding: '28px 40px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 24,
  },
  brandBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  brandName: {
    fontFamily: "'EB Garamond', Georgia, serif",
    fontSize: 34,
    fontWeight: 700,
    letterSpacing: '0.18em',
    color: C.ivory,
    lineHeight: 1,
    textTransform: 'uppercase',
  },
  brandTagline: {
    fontSize: 11,
    letterSpacing: '0.22em',
    color: 'rgba(246,238,225,0.65)',
    textTransform: 'uppercase',
    fontFamily: "'EB Garamond', Georgia, serif",
  },
  invoiceMeta: {
    textAlign: 'right',
  },
  invoiceLabel: {
    fontSize: 11,
    letterSpacing: '0.3em',
    color: 'rgba(246,238,225,0.55)',
    textTransform: 'uppercase',
    marginBottom: 4,
    fontFamily: "'EB Garamond', Georgia, serif",
  },
  invoiceNumber: {
    fontSize: 26,
    fontWeight: 700,
    color: C.ivory,
    letterSpacing: '0.06em',
    fontFamily: "'EB Garamond', Georgia, serif",
  },
  invoiceDate: {
    fontSize: 12,
    color: 'rgba(246,238,225,0.65)',
    letterSpacing: '0.12em',
    marginTop: 4,
    fontFamily: "'EB Garamond', Georgia, serif",
  },
  body: {
    padding: '36px 40px 0',
  },
  addressSection: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 36,
    paddingBottom: 28,
    borderBottom: `1.5px solid ${C.ivoryDark}`,
    gap: 24,
  },
  addressBox: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 9,
    letterSpacing: '0.28em',
    textTransform: 'uppercase',
    color: C.muted,
    marginBottom: 10,
    fontFamily: "'EB Garamond', Georgia, serif",
  },
  addressName: {
    fontSize: 17,
    fontWeight: 700,
    color: C.text,
    letterSpacing: '0.03em',
    marginBottom: 5,
    fontFamily: "'EB Garamond', Georgia, serif",
  },
  addressLine: {
    fontSize: 13,
    color: '#6B5060',
    lineHeight: 1.65,
    maxWidth: 340,
    fontFamily: "'EB Garamond', Georgia, serif",
  },
  addressPhone: {
    fontSize: 13,
    color: C.muted,
    marginTop: 6,
    letterSpacing: '0.06em',
    fontFamily: "'EB Garamond', Georgia, serif",
  },
  statusBadge: {
    background: C.ivoryMid,
    border: `1px solid ${C.ivoryDark}`,
    borderRadius: 2,
    padding: '8px 18px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#2E8B57',
    marginBottom: 2,
  },
  statusLabel: {
    fontSize: 9,
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
    color: C.muted,
    fontFamily: "'EB Garamond', Georgia, serif",
  },
  statusValue: {
    fontSize: 11,
    fontWeight: 600,
    color: '#2E8B57',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    fontFamily: "'EB Garamond', Georgia, serif",
  },
  tableWrap: {
    marginBottom: 0,
  },
  tableHeadRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 80px 60px 100px 100px',
    padding: '10px 16px',
    background: C.burgundy,
    borderRadius: 2,
    marginBottom: 2,
  },
  thCell: {
    fontSize: 9,
    letterSpacing: '0.24em',
    textTransform: 'uppercase',
    color: 'rgba(246,238,225,0.7)',
    fontFamily: "'EB Garamond', Georgia, serif",
  },
  thCellRight: {
    textAlign: 'right',
    fontSize: 9,
    letterSpacing: '0.24em',
    textTransform: 'uppercase',
    color: 'rgba(246,238,225,0.7)',
    fontFamily: "'EB Garamond', Georgia, serif",
  },
  itemRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 80px 60px 100px 100px',
    padding: '16px 16px',
    borderBottom: `1px solid ${C.ivoryMid}`,
    alignItems: 'center',
  },
  itemName: {
    fontSize: 14,
    color: C.text,
    fontWeight: 500,
    fontFamily: "'EB Garamond', Georgia, serif",
    letterSpacing: '0.02em',
  },
  itemCell: {
    fontSize: 13,
    color: '#6B5060',
    fontFamily: "'EB Garamond', Georgia, serif",
  },
  itemCellRight: {
    fontSize: 13,
    color: '#6B5060',
    textAlign: 'right',
    fontFamily: "'EB Garamond', Georgia, serif",
  },
  itemTotal: {
    fontSize: 14,
    color: C.text,
    fontWeight: 600,
    textAlign: 'right',
    fontFamily: "'EB Garamond', Georgia, serif",
  },
  totalsSection: {
    display: 'flex',
    justifyContent: 'flex-end',
    padding: '24px 0 0',
  },
  totalsBox: {
    minWidth: 260,
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '7px 0',
    borderBottom: `1px solid ${C.ivoryMid}`,
    gap: 40,
  },
  totalLabel: {
    fontSize: 12,
    color: C.muted,
    letterSpacing: '0.10em',
    textTransform: 'uppercase',
    fontFamily: "'EB Garamond', Georgia, serif",
  },
  totalValue: {
    fontSize: 13,
    color: C.text,
    fontFamily: "'EB Garamond', Georgia, serif",
  },
  grandTotalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 16px',
    background: `linear-gradient(135deg, ${C.ivory} 0%, #fff 100%)`,
    border: `1.5px solid ${C.ivoryDark}`,
    borderLeft: `5px solid ${C.burgundy}`,
    borderRadius: 2,
    marginTop: 8,
    gap: 40,
    boxShadow: '0 10px 20px rgba(106,1,42,0.08)',
  },
  grandTotalLabel: {
    fontSize: 11,
    letterSpacing: '0.26em',
    textTransform: 'uppercase',
    color: C.muted,
    fontFamily: "'EB Garamond', Georgia, serif",
  },
  grandTotalValue: {
    fontSize: 22,
    fontWeight: 700,
    color: C.burgundy,
    letterSpacing: '0.04em',
    fontFamily: "'EB Garamond', Georgia, serif",
  },
  footerNote: {
    margin: '32px 0 0',
    padding: '20px 40px',
    background: C.ivoryMid,
    borderTop: `1.5px solid ${C.ivoryDark}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 24,
    flexWrap: 'wrap',
  },
  footerText: {
    fontSize: 11,
    color: C.muted,
    letterSpacing: '0.08em',
    fontFamily: "'EB Garamond', Georgia, serif",
    maxWidth: 360,
    lineHeight: 1.6,
  },
  footerContact: {
    fontSize: 10,
    color: C.muted,
    letterSpacing: '0.1em',
    fontFamily: "'EB Garamond', Georgia, serif",
    textAlign: 'right',
    lineHeight: 1.8,
  },
  actions: {
    padding: '28px 40px 36px',
    display: 'flex',
    gap: 12,
    background: '#fff',
  },
  btnPrint: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '11px 26px',
    background: C.burgundy,
    color: C.ivory,
    border: 'none',
    borderRadius: 2,
    cursor: 'pointer',
    fontSize: 12,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    fontFamily: "'EB Garamond', Georgia, serif",
    fontWeight: 600,
  },
  btnBack: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '11px 26px',
    background: 'transparent',
    color: C.burgundy,
    border: `1.5px solid ${C.burgundy}`,
    borderRadius: 2,
    cursor: 'pointer',
    fontSize: 12,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    fontFamily: "'EB Garamond', Georgia, serif",
    fontWeight: 600,
    textDecoration: 'none',
  },
};

/* ─── Component ─────────────────────────────────────────────── */
export default function Invoice() {
  //  Fix 1: typed useParams
  const { id } = useParams<{ id: string }>();

  const { data: order, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => getOrderDetail(Number(id)),
    enabled: !!id,
  });

  //  Fix 2: inject Google Font + print CSS via useEffect (not <link> in JSX)
  useEffect(() => {
    if (document.getElementById('twam-invoice-styles')) return;
    const link = document.createElement('link');
    link.id = 'twam-invoice-styles';
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;0,700;1,400&display=swap';
    document.head.appendChild(link);

    const style = document.createElement('style');
    style.textContent = `
      @page {
        size: auto;
        margin: 0mm;
      }
      @media print {
        /* Remove browser's own date / title / URL header+footer */
        html, body {
          background: #fff !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        /* Hide site navbar, site footer, and action buttons */
        header,
        footer,
        nav,
        aside,
        .no-print,
        [class*="navbar"],
        [class*="nav-bar"],
        [class*="site-header"],
        [class*="site-footer"],
        [class*="topbar"],
        [class*="bottom-bar"] {
          display: none !important;
          visibility: hidden !important;
        }

        /* Show only the invoice card */
        body > *:not(.invoice-print-root) {
          display: none !important;
        }

        .invoice-print-root {
          display: block !important;
          padding: 0 !important;
          margin: 0 !important;
          min-height: unset !important;
          background: #fff !important;
        }
      }
    `;
    document.head.appendChild(style);
  }, []);

  if (isLoading) {
    return (
      <div style={{ ...styles.page, justifyContent: 'center', alignItems: 'center' }}>
        <span style={{ color: C.burgundy, letterSpacing: '0.18em', fontSize: 13 }}>
          LOADING INVOICE…
        </span>
      </div>
    );
  }

  if (!order) {
    return (
      <div style={{ ...styles.page, justifyContent: 'center', alignItems: 'center' }}>
        <span style={{ color: C.muted, letterSpacing: '0.12em', fontSize: 13 }}>
          Invoice not found.
        </span>
      </div>
    );
  }

  const items: any[] = order.orderItems || order.items || [];

  //  Fix 3: explicitly typed TotalRow array — no implicit `any` on `green`
  const totals: TotalRow[] = [
    { label: 'Subtotal', value: `₹${(order.subTotal || 0).toLocaleString('en-IN')}` },
    {
      label: 'Shipping',
      value: (order.deliveryCharge || 0) === 0
        ? 'FREE'
        : `₹${(order.deliveryCharge || 0).toLocaleString('en-IN')}`,
    },
    ...(order.couponAmount > 0
      ? [{ label: 'Coupon Discount', value: `−₹${order.couponAmount.toLocaleString('en-IN')}`, green: true }]
      : []
    ),
  ];

  return (
    <div style={styles.page} className="invoice-print-root">
      <div style={styles.card}>

        {/* Accent bar */}
        <div style={styles.accentBar} />

        {/* ── Header ── */}
        <div style={styles.headerBand}>
          <div style={styles.brandBlock}>
            <span style={styles.brandName}><img src="/assets/twam-white.jpeg" alt="" /></span>
            <span style={styles.brandTagline}>Only TWAM — It's all about you</span>
          </div>
          <div style={styles.invoiceMeta}>
            <div style={styles.invoiceLabel}>Invoice</div>
            <div style={styles.invoiceNumber}>#{order.orderNumber || id}</div>
            <div style={styles.invoiceDate}>
              Date: {formatDate(order.orderDate || order.createdAt)}
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div id="invoice-print" style={styles.body}>

          {/* Address + Status */}
          {order.shippingAddress && (
            <div style={styles.addressSection}>
              <div style={styles.addressBox}>
                <div style={styles.addressLabel}>Bill / Ship To</div>
                <div style={styles.addressName}>{order.shippingAddress.nam}</div>
                <div style={styles.addressLine}>
                  {[
                    order.shippingAddress.addressLine,
                    order.shippingAddress.locality,
                    order.shippingAddress.city,
                    order.shippingAddress.state,
                    order.shippingAddress.pinCode,
                  ].filter(Boolean).join(', ')}
                </div>
                <div style={styles.addressPhone}>{order.shippingAddress.phone}</div>
              </div>

              {/*  Fix 4: statusBadge is self-contained — no stray spans inside */}
              <div style={styles.statusBadge}>
                <div style={styles.statusDot} />
                <div style={styles.statusLabel}>Status</div>
                <div style={styles.statusValue}>{order.status || 'Confirmed'}</div>
              </div>
            </div>
          )}

          {/* Items table */}
          <div style={styles.tableWrap}>
            {/*  Fix 5: header row and item rows are separate — no mixed spans */}
            <div style={styles.tableHeadRow}>
              <span style={styles.thCell}>Product</span>
              <span style={styles.thCell}>Size</span>
              <span style={styles.thCell}>Qty</span>
              <span style={styles.thCellRight}>Price</span>
              <span style={styles.thCellRight}>Total</span>
            </div>

            {items.map((item, i) => (
              <div key={i} style={styles.itemRow}>
                <span style={styles.itemName}>{item.productName || item.name}</span>
                <span style={styles.itemCell}>{item.size || '—'}</span>
                <span style={styles.itemCell}>{item.quantity}</span>
                <span style={styles.itemCellRight}>
                  ₹{(item.price || 0).toLocaleString('en-IN')}
                </span>
                <span style={styles.itemTotal}>
                  ₹{((item.price || 0) * item.quantity).toLocaleString('en-IN')}
                </span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div style={styles.totalsSection}>
            <div style={styles.totalsBox}>
              {/*  Fix 6: destructure with typed TotalRow — no implicit any on `green` */}
              {totals.map(({ label, value, green }: TotalRow) => (
                <div key={label} style={styles.totalRow}>
                  <span style={styles.totalLabel}>{label}</span>
                  <span
                    style={{
                      ...styles.totalValue,
                      ...(green ? { color: '#2E8B57', fontWeight: 600 } : {}),
                    }}
                  >
                    {value}
                  </span>
                </div>
              ))}
              <div style={styles.grandTotalRow}>
                <span style={styles.grandTotalLabel}>Total</span>
                <span style={styles.grandTotalValue}>
                  ₹{(order.totalAmount || 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer note ── */}
        <div style={styles.footerNote}>
          <p style={styles.footerText}>
            We are Only TWAM, a multibrand platform where women have a wide variety of lingerie
            brands, that can help them pick their most comfortable fit based on their daily needs.
          </p>
          <div style={styles.footerContact}>
            <div>customersupport@onlytwam.com</div>
            <div>+91 7036534449</div>
          </div>
        </div>

        {/* ── Actions ── */}
        <div style={styles.actions} className="no-print">
          <button
            onClick={() => window.print()}
            style={styles.btnPrint}
            onMouseOver={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseOut={e => (e.currentTarget.style.opacity = '1')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            Print / Download
          </button>
          <Link to="/account/orders-list" style={styles.btnBack}>
            ← Back to Orders
          </Link>
        </div>

      </div>
    </div>
  );
}
