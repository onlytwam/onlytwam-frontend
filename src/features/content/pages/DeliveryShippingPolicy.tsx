import { Link } from 'react-router-dom';
export default function DeliveryShippingPolicy() {
  return (
    <div>
      <div style={{ background: 'linear-gradient(135deg, #6A012A, #111)', color: '#fff', padding: '60px 16px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, margin: '0 0 10px' }}>Delivery & Shipping Policy</h1>
        <p style={{ opacity: .8, margin: 0 }}>Our policy for deliveries and shipments.</p>
      </div>
      <div className="container" style={{ padding: '48px 16px', maxWidth: 860, color: '#555', lineHeight: 1.9 }}>
        <h3 style={{ color: '#111', marginTop: 0 }}>Free Shipping</h3>
        <ul style={{ paddingLeft: 20 }}><li>Delivered within 7–10 business days.</li><li>Shipping Cost: ₹0 (for orders over ₹5000).</li></ul>
        <h3 style={{ color: '#111' }}>Standard Delivery</h3>
        <ul style={{ paddingLeft: 20 }}><li>Delivered within 5–7 business days.</li><li>Shipping Cost: ₹99 for orders below ₹5000.</li></ul>
        <h3 style={{ color: '#111' }}>Express Delivery</h3>
        <ul style={{ paddingLeft: 20 }}><li>Delivered within 2–3 business days (select cities).</li><li>Shipping Cost: ₹199.</li></ul>
        <h3 style={{ color: '#111' }}>Important Notes</h3>
        <ul style={{ paddingLeft: 20 }}>
          <li>Delivery timelines are estimates and may vary during peak season, public holidays, or unforeseen circumstances.</li>
          <li>Orders placed after 12 PM are processed the next business day.</li>
          <li>We do not ship internationally at this time.</li>
          <li>Once shipped, you will receive a tracking link via SMS and email.</li>
        </ul>
        <p style={{ marginTop: 24 }}>Questions? <Link to="/contact-us" style={{ color: '#6A012A', fontWeight: 600 }}>Contact Us</Link> or email <a href="mailto:customersupport@onlytwam.com" style={{ color: '#6A012A' }}>customersupport@onlytwam.com</a></p>
      </div>
    </div>
  );
}