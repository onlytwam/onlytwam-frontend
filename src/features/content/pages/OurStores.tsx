import { Link } from 'react-router-dom';

export default function OurStores() {
  return (
    <div>
      <div className="page-title" style={{ background: '#fff', padding: '12px 0', borderBottom: '1px solid #eee' }}>
        <div className="container">
          <nav className="breadcrumbs">
            <ol className="pb-0">
              <li><Link to="/">Home</Link></li>
              <li className="current">Our Stores</li>
            </ol>
          </nav>
        </div>
      </div>

      <div className="container" style={{ padding: '40px 16px' }}>
        <h5 style={{ fontWeight: 700, marginBottom: 24, fontSize: 18 }}>Our Stores</h5>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
          {/* Store Info */}
          <div style={{ flex: '0 0 280px', minWidth: 240 }}>
            <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 42, height: 42, background: '#fff5f5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="bi bi-shop" style={{ fontSize: 20, color: '#6A012A' }} />
                </div>
                <h5 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>TWAM Store, Hyderabad</h5>
              </div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 12, fontSize: 13, color: '#555' }}>
                <i className="bi bi-geo-alt-fill" style={{ color: '#6A012A', flexShrink: 0, marginTop: 2 }} />
                <p style={{ margin: 0, lineHeight: 1.6 }}>GSM Mall, Miyapur Main Rd, ICRISAT Colony, Madeenaguda, Hyderabad, Telangana 500050</p>
              </div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 12, fontSize: 13, color: '#555' }}>
                <i className="bi bi-telephone-fill" style={{ color: '#6A012A', flexShrink: 0 }} />
                <a href="tel:+917036534449" style={{ color: '#555', textDecoration: 'none' }}>+91 7036534449</a>
              </div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, fontSize: 13, color: '#555' }}>
                <i className="bi bi-clock-fill" style={{ color: '#6A012A', flexShrink: 0 }} />
                <span>Mon–Sat: 10:00 AM – 8:00 PM</span>
              </div>
              <a href="https://maps.google.com/?q=TWAM+store+Hyderabad" target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#111', color: '#fff', padding: '8px 16px', borderRadius: 6, fontSize: 13, textDecoration: 'none' }}>
                <i className="bi bi-map" /> Get Directions
              </a>
            </div>
          </div>

          {/* Map */}
          <div style={{ flex: 1, minWidth: 280, minHeight: 380 }}>
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3805.237817198014!2d78.33310847414386!3d17.49615739966458!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bcb9300258c22ed%3A0x13b73f6f50ff06d8!2sTWAM%20store!5e0!3m2!1sen!2sin!4v1749451493523!5m2!1sen!2sin"
              width="100%" height="450" style={{ border: 0, borderRadius: 12 }}
              allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade"
              title="TWAM Store Map" />
          </div>
        </div>
      </div>
    </div>
  );
}