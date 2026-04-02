import { useNavigate } from 'react-router-dom';

export default function OnlyTwam() {
  const navigate = useNavigate();
  return (
    <div>
      <img src="/assets/only-twam-brand.jpg" className="img-fluid" style={{ width: '100%', display: 'block', maxHeight: 500, objectFit: 'cover' }}
        onError={e => { (e.target as HTMLImageElement).src = '/assets/aboutus-banner.jpg'; }} alt="Only TWAM" />

      <section className="shipping_section">
        <div className="container">
          <div className="shipping_inner">
            {[
              { icon: 'icon-cursor', title: 'Free Shipping', sub: <span>Orders over <span className="color-primary font-medium">₹5000</span></span> },
              { icon: 'icon-reload', title: 'Free Returns', sub: <span>Within <span className="color-primary font-medium">15</span> days</span> },
              { icon: 'icon-lock', title: '100% Payment Secure', sub: 'Payment Online' },
              { icon: 'icon-tag', title: 'Affordable Price', sub: 'Guaranteed' },
            ].map(f => (
              <div key={f.title} className="single_shipping">
                <div className="shipping_icon"><i className={`${f.icon} icons`} /></div>
                <div className="shipping_text"><h3>{f.title}</h3><p>{f.sub}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="container" style={{ padding: '48px 16px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 className="section-title">Why Only TWAM?</h2>
          <p style={{ color: '#888', maxWidth: 600, margin: '12px auto 0', fontSize: 15 }}>
            We are a multibrand platform where women discover a wide variety of lingerie brands — curated to help you pick your most comfortable fit based on your daily needs.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24, marginBottom: 48 }}>
          {[
            { icon: '🌸', title: 'Comfort First', desc: 'Every product is chosen with your comfort as the top priority. Because a bra should work with your body, not against it.' },
            { icon: '✨', title: 'Premium Brands', desc: 'We curate only the best brands — Amante, Enamor, Soie, Blossom and more — all in one place for you.' },
            { icon: '📏', title: 'Your Perfect Fit', desc: 'With our Size Guide and Fit Finder, we help you find the exact size that works for your unique body.' },
            { icon: '💝', title: 'Made for Real Women', desc: 'From everyday essentials to special occasion wear — we celebrate every body, every size, every shape.' },
          ].map(card => (
            <div key={card.title} style={{ background: '#fff5f5', borderRadius: 12, padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>{card.icon}</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px', color: '#111' }}>{card.title}</h3>
              <p style={{ fontSize: 14, color: '#666', margin: 0, lineHeight: 1.7 }}>{card.desc}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 24, alignItems: 'center', background: '#111', borderRadius: 16, padding: '32px 40px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: '#fff', margin: '0 0 10px' }}>Confidence Starts Here</h2>
            <p style={{ color: '#aaa', margin: '0 0 20px', fontSize: 15 }}>Explore our full collection and find your perfect fit today.</p>
            <button onClick={() => navigate('/user-products/product-list')}
              style={{ background: '#6A012A', color: '#fff', border: 'none', padding: '12px 28px', borderRadius: 6, cursor: 'pointer', fontSize: 15, fontWeight: 600, fontFamily: 'inherit' }}>
              Shop Now →
            </button>
          </div>
          <img src="/assets/about-twam.jpg" alt="TWAM"
            style={{ width: 180, height: 180, objectFit: 'cover', borderRadius: 12 }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>
      </div>
    </div>
  );
}