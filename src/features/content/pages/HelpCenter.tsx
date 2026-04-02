export default function HelpCenter() {
  return (
    <div>
      <div style={{ background: '#f9f9f9', padding: '48px 16px', textAlign: 'center', borderBottom: '1px solid #eee' }}>
        <h2 style={{ fontWeight: 800 }}>Help Center</h2>
      </div>
      <div className="container" style={{ padding: '48px 16px', maxWidth: 800, color: '#555', lineHeight: 1.9 }}>
        <h5 style={{fontWeight:700,marginTop:0}}>Frequently Asked Questions</h5><p><strong>How do I track my order?</strong><br/>Go to My Orders in your account to see real-time tracking updates.</p><p><strong>What is your return policy?</strong><br/>We accept returns within 7 days of delivery for unused, unwashed items with tags intact. Visit our Return & Refund Policy page for details.</p><p><strong>How long does delivery take?</strong><br/>Standard delivery takes 4–7 business days. Express options may be available at checkout.</p><p><strong>How do I find my correct size?</strong><br/>Use our Size Guide and Fit Finder tool to determine your perfect size. Our customer care team is also happy to help.</p><p><strong>Can I exchange a product?</strong><br/>Yes! Visit your order and initiate a return with the Exchange option selected.</p><p style={{marginTop:24}}>Need more help? <a href='/contact-us' style={{color:'#6A012A',fontWeight:600}}>Contact our support team</a> — we're here Mon–Sat, 9 AM–6 PM IST.</p>
      </div>
    </div>
  );
}
