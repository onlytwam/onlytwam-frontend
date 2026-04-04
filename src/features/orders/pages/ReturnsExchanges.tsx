import { Link } from 'react-router-dom';
export default function ReturnsExchanges() {
  return (
    <div>
      <div className="s-returnsexcha-690d55">
        <h1 className="s-deliveryship-13f5e5">Returns & Exchanges</h1>
        <p className="s-privacypolic-45389b s-returnsexcha-5d4cf1">Hassle-free returns within 15 days.</p>
      </div>
      <div className="container s-deliveryship-6da314">
        <div className="s-returnsexcha-0ebbd1">
          <i className="bi bi-info-circle-fill s-returnsexcha-5bc885" />
          <p className="s-adminorders-18f7bb">We want you to love every purchase. If something isn't right, we'll make it right — free returns and exchanges within <strong>15 days</strong> of delivery.</p>
        </div>
        <h3 className="s-deliveryship-a4dc9e">Return Policy</h3>
        <ul className="s-deliveryship-35e44d">
          <li>Items must be returned within 15 days of delivery.</li>
          <li>Products must be unworn, unwashed, and with original tags attached.</li>
          <li>Innerwear and swimwear can only be exchanged, not returned, for hygiene reasons.</li>
          <li>Items marked as "Final Sale" are not eligible for return or exchange.</li>
        </ul>
        <h3 className="s-deliveryship-562796">How to Return</h3>
        <ol className="s-deliveryship-35e44d">
          <li>Log into your account and go to <strong>My Orders</strong>.</li>
          <li>Select the order and click <strong>Return/Exchange</strong>.</li>
          <li>Choose your reason and preferred resolution (refund or exchange).</li>
          <li>Schedule a pickup or drop off at your nearest courier partner.</li>
          <li>Once received and inspected, your refund or exchange will be processed within 5–7 business days.</li>
        </ol>
        <h3 className="s-deliveryship-562796">Refund Timeline</h3>
        <table className="s-returnsexcha-72a21a">
          <thead><tr className="s-adminbrands-1ba202">
            <th className="s-returnsexcha-89794e">Payment Method</th>
            <th className="s-returnsexcha-89794e">Refund Timeline</th>
          </tr></thead>
          <tbody>
            {[['Credit/Debit Card','5–7 business days'],['UPI','2–3 business days'],['Net Banking','3–5 business days'],['TWAM Wallet','Instant']].map(r => (
              <tr key={r[0]} className="s-adminbrands-59d787">
                <td className="s-returnsexcha-c328ed">{r[0]}</td>
                <td className="s-returnsexcha-89ce57">{r[1]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="s-deliveryship-6c04e1">Questions? <Link to="/contact-us" className="s-register-51a817">Contact our support team</Link>.</p>
      </div>
    </div>
  );
}