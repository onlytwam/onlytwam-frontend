import { Link } from 'react-router-dom';
export default function ReturnsExchanges() {
  return (
    <div>
      <div style={{ background: 'linear-gradient(135deg, #6A012A, #111)', color: '#fff', padding: '60px 16px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, margin: '0 0 10px' }}>Returns & Exchanges</h1>
        <p style={{ opacity: .8, fontSize: 16, margin: 0 }}>Hassle-free returns within 15 days.</p>
      </div>
      <div className="container" style={{ padding: '48px 16px', maxWidth: 860, color: '#555', lineHeight: 1.9 }}>
        <div style={{ background: '#fff5f5', border: '1px solid #f0c0c0', borderRadius: 10, padding: 20, marginBottom: 32, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <i className="bi bi-info-circle-fill" style={{ color: '#6A012A', fontSize: 22, flexShrink: 0 }} />
          <p style={{ margin: 0 }}>We want you to love every purchase. If something isn't right, we'll make it right — free returns and exchanges within <strong>15 days</strong> of delivery.</p>
        </div>
        <h3 style={{ color: '#111', marginTop: 0 }}>Return Policy</h3>
        <ul style={{ paddingLeft: 20 }}>
          <li>Items must be returned within 15 days of delivery.</li>
          <li>Products must be unworn, unwashed, and with original tags attached.</li>
          <li>Innerwear and swimwear can only be exchanged, not returned, for hygiene reasons.</li>
          <li>Items marked as "Final Sale" are not eligible for return or exchange.</li>
        </ul>
        <h3 style={{ color: '#111' }}>How to Return</h3>
        <ol style={{ paddingLeft: 20 }}>
          <li>Log into your account and go to <strong>My Orders</strong>.</li>
          <li>Select the order and click <strong>Return/Exchange</strong>.</li>
          <li>Choose your reason and preferred resolution (refund or exchange).</li>
          <li>Schedule a pickup or drop off at your nearest courier partner.</li>
          <li>Once received and inspected, your refund or exchange will be processed within 5–7 business days.</li>
        </ol>
        <h3 style={{ color: '#111' }}>Refund Timeline</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead><tr style={{ background: '#f5f5f5' }}>
            <th style={{ padding: '10px 14px', textAlign: 'left', borderBottom: '2px solid #eee' }}>Payment Method</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', borderBottom: '2px solid #eee' }}>Refund Timeline</th>
          </tr></thead>
          <tbody>
            {[['Credit/Debit Card','5–7 business days'],['UPI','2–3 business days'],['Net Banking','3–5 business days'],['TWAM Wallet','Instant']].map(r => (
              <tr key={r[0]} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '10px 14px', color: '#111' }}>{r[0]}</td>
                <td style={{ padding: '10px 14px', color: '#555' }}>{r[1]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ marginTop: 24 }}>Questions? <Link to="/contact-us" style={{ color: '#6A012A', fontWeight: 600 }}>Contact our support team</Link>.</p>
      </div>
    </div>
  );
}