import { Link } from 'react-router-dom';
export default function ReturnRefundPolicy() {
  return (
    <div>
      <div style={{ background: 'linear-gradient(135deg, #6A012A, #111)', color: '#fff', padding: '60px 16px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, margin: '0 0 10px' }}>Return & Refund Policy</h1>
        <p style={{ opacity: .8, margin: 0 }}>Easy returns within 15 days of delivery.</p>
      </div>
      <div className="container" style={{ padding: '48px 16px', maxWidth: 860, color: '#555', lineHeight: 1.9 }}>
        <h3 style={{ color: '#111', marginTop: 0 }}>Return Eligibility</h3>
        <ul style={{ paddingLeft: 20 }}>
          <li>Items must be returned within <strong>15 days</strong> of delivery.</li>
          <li>Products must be unworn, unwashed, with original tags and packaging.</li>
          <li>Innerwear and swimwear: exchange only (not eligible for full return).</li>
          <li>"Final Sale" or heavily discounted items are non-returnable.</li>
        </ul>
        <h3 style={{ color: '#111' }}>Refund Process</h3>
        <ul style={{ paddingLeft: 20 }}>
          <li>Once your return is received and inspected, we will process your refund within 5–7 business days.</li>
          <li>Refunds are credited to the original payment method.</li>
          <li>Shipping charges are non-refundable unless the return is due to a defect or wrong item.</li>
        </ul>
        <h3 style={{ color: '#111' }}>How to Initiate a Return</h3>
        <ol style={{ paddingLeft: 20 }}>
          <li>Log in to your account and go to <strong>My Orders</strong>.</li>
          <li>Select the order and click <strong>Return / Exchange</strong>.</li>
          <li>Choose your reason and preferred resolution.</li>
          <li>Schedule a pickup or drop off at a courier partner.</li>
        </ol>
        <p style={{ marginTop: 24 }}><Link to="/contact-us" style={{ color: '#6A012A', fontWeight: 600 }}>Contact support</Link> for any return queries.</p>
      </div>
    </div>
  );
}