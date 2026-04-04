export default function ShippingInfo() {
  return (
    <div>
      <div className="s-shippinginfo-de033c">
        <h1 className="s-deliveryship-13f5e5">Shipping Information</h1>
        <p className="s-privacypolic-45389b s-shippinginfo-b5cf00">Everything you need to know about delivery.</p>
      </div>
      <div className="container s-deliveryship-6da314">
        <div className="s-shippinginfo-099014">
          {[
            { icon: 'bi-truck', title: 'Free Shipping', desc: 'On all orders above ₹5,000' },
            { icon: 'bi-clock', title: 'Delivery Time', desc: '4–7 business days standard' },
            { icon: 'bi-geo-alt', title: 'Pan India Delivery', desc: 'We ship to all major cities and towns' },
            { icon: 'bi-shield-check', title: 'Safe Packaging', desc: 'Discreet and secure packaging always' },
          ].map(f => (
            <div key={f.title} className="s-shippinginfo-25a64f">
              <i className={`bi ${f.icon} s-shippinginfo-0f0c19`} />
              <h4 className="s-shippinginfo-c1025b">{f.title}</h4>
              <p className="s-shippinginfo-5d4f15">{f.desc}</p>
            </div>
          ))}
        </div>
        <h3 className="s-deliveryship-a4dc9e">Delivery Options</h3>
        <table className="s-returnsexcha-72a21a">
          <thead><tr className="s-adminbrands-1ba202">
            <th className="s-returnsexcha-89794e">Option</th>
            <th className="s-returnsexcha-89794e">Timeline</th>
            <th className="s-returnsexcha-89794e">Cost</th>
          </tr></thead>
          <tbody>
            {[['Standard Delivery','5–7 business days','₹99 (Free above ₹5,000)'],['Express Delivery','2–3 business days','₹199'],['Same Day (Select Cities)','Order before 12 PM','₹299']].map(r => (
              <tr key={r[0]} className="s-adminbrands-59d787">
                {r.map((c, i) => <td key={i} className="s-shippinginfo-2e453a" style={ {color: i === 0 ? '#000000' : 'var(--heirloom)'} }>{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        <h3 className="s-shippinginfo-56deab">Order Tracking</h3>
        <p>Once your order is shipped, you'll receive an SMS and email with your tracking number. You can also track your order from <strong>My Account → Orders</strong>.</p>
        <h3 className="s-deliveryship-562796">Important Notes</h3>
        <ul className="s-deliveryship-35e44d">
          <li>Delivery timelines are estimates and may vary during peak periods.</li>
          <li>We currently do not ship internationally.</li>
          <li>For remote locations, additional 2–3 days may apply.</li>
        </ul>
      </div>
    </div>
  );
}