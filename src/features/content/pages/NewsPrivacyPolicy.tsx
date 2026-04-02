export default function NewsPrivacyPolicy() {
  return (
    <div>
      <div style={{ background: 'linear-gradient(135deg, #6A012A, #111)', color: '#fff', padding: '60px 16px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, margin: '0 0 10px' }}>Newsletter Privacy Policy</h1>
        <p style={{ opacity: .8, margin: 0 }}>How we use your newsletter subscription data.</p>
      </div>
      <div className="container" style={{ padding: '48px 16px', maxWidth: 860, color: '#555', lineHeight: 1.9 }}>
        <h3 style={{ color: '#111', marginTop: 0 }}>What We Collect</h3>
        <p>When you subscribe to our newsletter, we collect your email address and, optionally, your name.</p>
        <h3 style={{ color: '#111' }}>How We Use It</h3>
        <ul style={{ paddingLeft: 20 }}>
          <li>To send you new arrivals, exclusive offers, and style updates.</li>
          <li>To personalize content based on your preferences.</li>
          <li>We will never sell or share your email with third parties for marketing purposes.</li>
        </ul>
        <h3 style={{ color: '#111' }}>Unsubscribing</h3>
        <p>You can unsubscribe at any time by clicking the "Unsubscribe" link at the bottom of any of our emails, or by contacting us at <a href="mailto:customersupport@onlytwam.com" style={{ color: '#6A012A' }}>customersupport@onlytwam.com</a>.</p>
        <h3 style={{ color: '#111' }}>Data Retention</h3>
        <p>We retain your email address until you unsubscribe. Upon unsubscribing, your data is removed from our mailing list within 30 days.</p>
      </div>
    </div>
  );
}