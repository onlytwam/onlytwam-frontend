export default function ShippingInfo() {
  return (
    <div>
      <div style={{ background: 'linear-gradient(135deg, #6A012A, #111)', color: '#fff', padding: '60px 16px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, margin: '0 0 10px' }}>Shipping Information</h1>
        <p style={{ opacity: .8, fontSize: 16, margin: 0 }}>Everything you need to know about delivery.</p>
      </div>
      <div className="container" style={{ padding: '48px 16px', maxWidth: 860, color: '#555', lineHeight: 1.9 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24, marginBottom: 40 }}>
          {[
            { icon: 'bi-truck', title: 'Free Shipping', desc: 'On all orders above ₹5,000' },
            { icon: 'bi-clock', title: 'Delivery Time', desc: '4–7 business days standard' },
            { icon: 'bi-geo-alt', title: 'Pan India Delivery', desc: 'We ship to all major cities and towns' },
            { icon: 'bi-shield-check', title: 'Safe Packaging', desc: 'Discreet and secure packaging always' },
          ].map(f => (
            <div key={f.title} style={{ background: '#fff5f5', borderRadius: 10, padding: 20, textAlign: 'center' }}>
              <i className={`bi ${f.icon}`} style={{ fontSize: 32, color: '#6A012A', marginBottom: 12, display: 'block' }} />
              <h4 style={{ color: '#111', margin: '0 0 6px', fontSize: 15 }}>{f.title}</h4>
              <p style={{ fontSize: 13, margin: 0, color: '#888' }}>{f.desc}</p>
            </div>
          ))}
        </div>
        <h3 style={{ color: '#111', marginTop: 0 }}>Delivery Options</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead><tr style={{ background: '#f5f5f5' }}>
            <th style={{ padding: '10px 14px', textAlign: 'left', borderBottom: '2px solid #eee' }}>Option</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', borderBottom: '2px solid #eee' }}>Timeline</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', borderBottom: '2px solid #eee' }}>Cost</th>
          </tr></thead>
          <tbody>
            {[['Standard Delivery','5–7 business days','₹99 (Free above ₹5,000)'],['Express Delivery','2–3 business days','₹199'],['Same Day (Select Cities)','Order before 12 PM','₹299']].map(r => (
              <tr key={r[0]} style={{ borderBottom: '1px solid #f0f0f0' }}>
                {r.map((c, i) => <td key={i} style={{ padding: '10px 14px', color: i === 0 ? '#111' : '#555' }}>{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        <h3 style={{ color: '#111', marginTop: 32 }}>Order Tracking</h3>
        <p>Once your order is shipped, you'll receive an SMS and email with your tracking number. You can also track your order from <strong>My Account → Orders</strong>.</p>
        <h3 style={{ color: '#111' }}>Important Notes</h3>
        <ul style={{ paddingLeft: 20 }}>
          <li>Delivery timelines are estimates and may vary during peak periods.</li>
          <li>We currently do not ship internationally.</li>
          <li>For remote locations, additional 2–3 days may apply.</li>
        </ul>
      </div>
    </div>
  );
}