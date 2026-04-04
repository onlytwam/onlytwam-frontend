import { Link } from 'react-router-dom';
import Breadcrumb from '@/shared/components/Breadcrumb';
export default function About() {
  return (
    <div>
      <Breadcrumb items={[{ label: 'Home', path: '/' }, { label: 'About Us' }]} />
      <div className="s-about-936baf">
        <h1 className="s-about-9faa02">About Only TWAM</h1>
        <p className="s-about-8369f5">Where every body finds its perfect fit. It's all about you.</p>
      </div>
      <div className="container s-about-cbbd1a">
        <div className="s-about-ea78ec">
          <div>
            <h2 className="s-about-56a9e2">Our Story</h2>
            <p className="s-about-d77643">Only TWAM was born from a simple belief — every woman deserves lingerie that truly fits her body, celebrates her shape, and makes her feel confident every single day. We understand that finding the right fit isn't just about measurements; it's about feeling comfortable, beautiful, and unapologetically yourself.</p>
            <p className="s-about-cd720c">Founded with a passion for inclusive sizing and premium quality, TWAM brings you a curated collection of bras, panties, and intimate wear designed for real women — with real bodies.</p>
          </div>
          <div className="s-about-a4dfa1">
            <img src="/assets/images/TWAM.png" alt="TWAM" className="s-about-51ccb5" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <p className="s-about-0cc832">"It's all about you."</p>
          </div>
        </div>
        <div className="s-about-4aceb1">
          {[
            { icon: 'bi-heart', title: 'Made for Every Body', desc: 'Inclusive sizing from XS to 5XL, because every shape deserves to feel beautiful.' },
            { icon: 'bi-award', title: 'Premium Quality', desc: 'Hand-picked fabrics, expert stitching, and comfort-first designs that last.' },
            { icon: 'bi-truck', title: 'Fast Delivery', desc: 'Quick shipping across India with easy returns and exchanges.' },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="s-about-7db890">
              <i className={`bi ${icon} s-about-690bcc`} />
              <h6 className="s-resetpasswor-215432">{title}</h6>
              <p className="s-about-502dab">{desc}</p>
            </div>
          ))}
        </div>
        <div className="s-adminnewslet-e2e1e0">
          <Link to="/user-products/product-list" className="s-about-cd2a35">
            Shop the Collection
          </Link>
        </div>
      </div>
    </div>
  );
}