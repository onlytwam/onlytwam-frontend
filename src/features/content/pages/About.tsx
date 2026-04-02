import { Link } from 'react-router-dom';
import Breadcrumb from '@/shared/components/Breadcrumb';
export default function About() {
  return (
    <div>
      <Breadcrumb items={[{ label: 'Home', path: '/' }, { label: 'About Us' }]} />
      <div style={{ background: 'linear-gradient(135deg, #6A012A, #111)', color: '#fff', padding: '80px 16px', textAlign: 'center' }}>
        <h1 style={{ fontWeight: 800, fontSize: 42, marginBottom: 16 }}>About Only TWAM</h1>
        <p style={{ fontSize: 18, opacity: 0.85, maxWidth: 600, margin: '0 auto' }}>Where every body finds its perfect fit. It's all about you.</p>
      </div>
      <div className="container" style={{ padding: '60px 16px', maxWidth: 860 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, marginBottom: 60, alignItems: 'center' }}>
          <div>
            <h2 style={{ fontWeight: 700, marginBottom: 16 }}>Our Story</h2>
            <p style={{ color: '#555', lineHeight: 1.8 }}>Only TWAM was born from a simple belief — every woman deserves lingerie that truly fits her body, celebrates her shape, and makes her feel confident every single day. We understand that finding the right fit isn't just about measurements; it's about feeling comfortable, beautiful, and unapologetically yourself.</p>
            <p style={{ color: '#555', lineHeight: 1.8, marginTop: 12 }}>Founded with a passion for inclusive sizing and premium quality, TWAM brings you a curated collection of bras, panties, and intimate wear designed for real women — with real bodies.</p>
          </div>
          <div style={{ background: '#f9f9f9', borderRadius: 12, padding: 32, textAlign: 'center' }}>
            <img src="/assets/images/TWAM.png" alt="TWAM" style={{ maxWidth: 200 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <p style={{ fontStyle: 'italic', color: '#888', marginTop: 16 }}>"It's all about you."</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginBottom: 60 }}>
          {[
            { icon: 'bi-heart', title: 'Made for Every Body', desc: 'Inclusive sizing from XS to 5XL, because every shape deserves to feel beautiful.' },
            { icon: 'bi-award', title: 'Premium Quality', desc: 'Hand-picked fabrics, expert stitching, and comfort-first designs that last.' },
            { icon: 'bi-truck', title: 'Fast Delivery', desc: 'Quick shipping across India with easy returns and exchanges.' },
          ].map(({ icon, title, desc }) => (
            <div key={title} style={{ textAlign: 'center', padding: 24 }}>
              <i className={`bi ${icon}`} style={{ fontSize: 36, color: '#6A012A', display: 'block', marginBottom: 12 }} />
              <h6 style={{ fontWeight: 700, marginBottom: 8 }}>{title}</h6>
              <p style={{ color: '#888', fontSize: 14, lineHeight: 1.6 }}>{desc}</p>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center' }}>
          <Link to="/user-products/product-list" style={{ background: '#6A012A', color: '#fff', padding: '14px 36px', borderRadius: 4, textDecoration: 'none', fontWeight: 600, fontSize: 15 }}>
            Shop the Collection
          </Link>
        </div>
      </div>
    </div>
  );
}