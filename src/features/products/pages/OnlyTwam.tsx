import { useNavigate } from 'react-router-dom';

export default function OnlyTwam() {
  const navigate = useNavigate();
  return (
    <div>
      <img src="/assets/only-twam-brand.jpg" className="img-fluid s-onlytwam-41cf7b"
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

      <div className="container s-onlytwam-d2cece">
        <div className="s-onlytwam-f6a06f">
          <h2 className="section-title">Why Only TWAM?</h2>
          <p className="s-onlytwam-4e7ae3">
            We are a multibrand platform where women discover a wide variety of lingerie brands — curated to help you pick your most comfortable fit based on your daily needs.
          </p>
        </div>

        <div className="s-onlytwam-8d2700">
          {[
            { icon: '🌸', title: 'Comfort First', desc: 'Every product is chosen with your comfort as the top priority. Because a bra should work with your body, not against it.' },
            { icon: '✨', title: 'Premium Brands', desc: 'We curate only the best brands — Amante, Enamor, Soie, Blossom and more — all in one place for you.' },
            { icon: '📏', title: 'Your Perfect Fit', desc: 'With our Size Guide and Fit Finder, we help you find the exact size that works for your unique body.' },
            { icon: '💝', title: 'Made for Real Women', desc: 'From everyday essentials to special occasion wear — we celebrate every body, every size, every shape.' },
          ].map(card => (
            <div key={card.title} className="s-onlytwam-9c2efe">
              <div className="s-onlytwam-5be39e">{card.icon}</div>
              <h3 className="s-onlytwam-d04f48">{card.title}</h3>
              <p className="s-onlytwam-299b70">{card.desc}</p>
            </div>
          ))}
        </div>

        <div className="s-onlytwam-85526f">
          <div className="s-onlytwam-05c496">
            <h2 className="s-onlytwam-d7bdf8">Confidence Starts Here</h2>
            <p className="s-onlytwam-a68b9f">Explore our full collection and find your perfect fit today.</p>
            <button onClick={() => navigate('/user-products/product-list')}
              className="s-onlytwam-4f254a">
              Shop Now →
            </button>
          </div>
          <img src="/assets/about-twam.jpg" alt="TWAM"
            className="s-onlytwam-ebcdb2"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>
      </div>
    </div>
  );
}