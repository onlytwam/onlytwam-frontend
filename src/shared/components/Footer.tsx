import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/authStore';
import { isValidEmail } from '@/shared/utils/helpers';
import toast from 'react-hot-toast';
import api from '@/shared/api/axiosInstance';


export default function Footer() {
  const navigate  = useNavigate();
  const { hasValidToken } = useAuthStore();
  const currentYear = new Date().getFullYear();

  // ── Newsletter state ──────────────────────────────────────────────────────
  const [email,       setEmail]       = useState('');
  const [emailError,  setEmailError]  = useState(false);
  const [checking,    setChecking]    = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [checked,     setChecked]     = useState(false);   // true after Check is clicked
  const [isSubbed,    setIsSubbed]    = useState(false);   // DB subscription status

  const handleCheck = async () => {
    if (!email || !isValidEmail(email)) { setEmailError(true); return; }
    setEmailError(false);
    setChecking(true);
    try {
      const res = await api.get('/Newsletter/Check', { params: { email } });
      setIsSubbed(res.data?.isSubscribed ?? false);
      setChecked(true);
    } catch {
      toast.error('Could not check subscription status.');
    }
    setChecking(false);
  };

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      await api.post('/Newsletter/Subscribe', { email });
      setIsSubbed(true);
      toast.success('Subscribed! Welcome to TWAM.');
    } catch {
      toast.error('Could not subscribe. Please try again.');
    }
    setLoading(false);
  };

  const handleUnsubscribe = async () => {
    setLoading(true);
    try {
      await api.post('/Newsletter/Unsubscribe', { email });
      setIsSubbed(false);
      toast.success('You have been unsubscribed.');
    } catch {
      toast.error('Could not unsubscribe. Please try again.');
    }
    setLoading(false);
  };

  // scroll-to-top wrapper used by all nav buttons
  const goTo = (path: string) => {
    navigate(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToOrder = () => {
    if (hasValidToken()) goTo('/account/orders-list');
    else toast('Please login to access Orders');
  };
  return (
    <footer id="footer" className="footer">

      {/* Newsletter */}
      <div className="container" style={{ padding: '10px 16px 0' }}>
        <div className="subscribe-section">
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 24 }}>
            <div style={{ flex: '1 1 300px' }}>
              <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8, color: '#1a0a10' }}>
                Subscribe to Our Newsletter
              </h2>
              <h4 style={{ fontSize: 14, fontWeight: 400, color: '#666', margin: 0 }}>
                Be the first to know about new arrivals, limited-time offers, comfort tips, and more.
              </h4>
            </div>
            <div style={{ flex: '1 1 300px' }}>
              <>
                  <p style={{ fontSize: 13, color: '#555', marginBottom: 8 }}>Stay up to date</p>

                  {/* Email input + arrow button */}
                  <div style={{ display: 'flex', gap: 0 }}>
                    <input
                      type="text"
                      inputMode="email"
                      autoComplete="off"
                      name="newsletter_email"
                      placeholder="Enter your Email ID"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setEmailError(false); setChecked(false); }}
                      onKeyDown={e => e.key === 'Enter' && handleCheck()}
                      style={{
                        flex: 1, padding: '10px 14px',
                        border: `1px solid ${emailError ? '#e53935' : 'var(--border-color)'}`,
                        borderRadius: '8px 0 0 8px', fontSize: 14,
                        outline: 'none', borderRight: 'none', fontFamily: 'inherit',
                      }}
                    />
                    <button onClick={handleCheck} disabled={checking} style={{
                      background: 'var(--brand)', color: '#fff', border: 'none',
                      padding: '10px 18px', borderRadius: '0 8px 8px 0',
                      cursor: checking ? 'not-allowed' : 'pointer',
                      fontSize: 18, opacity: checking ? 0.7 : 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {checking
                        ? <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'nl-spin .7s linear infinite', display: 'inline-block' }} />
                        : '→'}
                    </button>
                  </div>
                  <style>{`@keyframes nl-spin{to{transform:rotate(360deg)}}`}</style>

                  {/* Validation error */}
                  <p style={{ color: emailError ? '#e53935' : 'transparent', fontSize: 12, marginTop: 4, height: 18, userSelect: 'none' }}>
                    * Please enter a valid email address
                  </p>

                  {/* Subscribe + Unsubscribe buttons — shown after Check */}
                  {checked && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>

                      {/* Subscribe button */}
                      <button
                        onClick={handleSubscribe}
                        disabled={isSubbed || loading}
                        title={isSubbed ? 'Already subscribed — cannot subscribe again' : 'Subscribe'}
                        style={{
                          flex: 1, padding: '10px 0', borderRadius: 6, fontSize: 13,
                          fontWeight: 600, fontFamily: 'inherit', cursor: isSubbed ? 'not-allowed' : 'pointer',
                          border: '1.5px solid var(--brand)',
                          background: isSubbed ? 'transparent' : 'var(--brand)',
                          color: isSubbed ? 'var(--heirloom)' : '#fff',
                          opacity: isSubbed ? 0.45 : loading ? 0.7 : 1,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          textDecoration: isSubbed ? 'line-through' : 'none',
                        }}>
                        {isSubbed && <i className="bi bi-slash-circle" style={{ fontSize: 13 }} />}
                        Subscribe
                      </button>

                      {/* Unsubscribe button */}
                      <button
                        onClick={handleUnsubscribe}
                        disabled={!isSubbed || loading}
                        title={!isSubbed ? 'Not subscribed — cannot unsubscribe' : 'Unsubscribe'}
                        style={{
                          flex: 1, padding: '10px 0', borderRadius: 6, fontSize: 13,
                          fontWeight: 600, fontFamily: 'inherit', cursor: !isSubbed ? 'not-allowed' : 'pointer',
                          border: '1.5px solid var(--brand)',
                          background: !isSubbed ? 'transparent' : 'var(--brand)',
                          color: !isSubbed ? 'var(--heirloom)' : '#fff',
                          opacity: !isSubbed ? 0.45 : loading ? 0.7 : 1,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          textDecoration: !isSubbed ? 'line-through' : 'none',
                        }}>
                        {!isSubbed && <i className="bi bi-slash-circle" style={{ fontSize: 13 }} />}
                        Unsubscribe
                      </button>

                    </div>
                  )}

                  <p style={{ fontSize: 12, color: '#888', marginTop: 8 }}>
                    By subscribing you agree to our{" "}
                    <Link to="/news-privacy-policy" style={{ color: 'var(--brand)' }}>Privacy policy</Link>
                  </p>
                </>
            </div>
          </div>
        </div>

        {/* Footer Links */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, paddingBottom: 40 }}>

          {/* Brand */}
          <div style={{ flex: '1 1 220px' }}>
            <Link to="/" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <img src="/assets/Twam-Logo-Black.png" style={{ height: 60, marginBottom: 16 }} alt="TWAM" />
            </Link>
            <p style={{ fontSize: 13, color: '#555', lineHeight: 1.7 }}>
              We are Only TWAM, a multibrand platform where women have a wide variety of lingerie brands,
              that can help them pick their most comfortable fit based on their daily needs.
            </p>
          </div>

          {/* Shop
          <div style={{ flex: '1 1 120px' }}>
            <h4 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: '#1a0a10' }}>Shop</h4>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <li><button onClick={() => goTo('/user-products/product-list')} style={btnLinkStyle}>New Arrivals</button></li>
              <li><button onClick={goToBestSellers}                            style={btnLinkStyle}>Best Sellers</button></li>
              <li><button onClick={() => goTo('/user-products/product-list')} style={btnLinkStyle}>Our Products</button></li>
              <li><button onClick={goToEssentials}                             style={btnLinkStyle}>Essentials</button></li>
            </ul>
          </div> */}

          {/* Support */}
          <div style={{ flex: '1 1 140px' }}>
            <h4 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: '#1a0a10' }}>Support</h4>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <li><button onClick={() => goTo('/size-guide')}                        style={btnLinkStyle}>Size Guide</button></li>
              <li><button onClick={goToOrder}                                          style={btnLinkStyle}>Order Status</button></li>
              <li><button onClick={() => goTo('/returns-exchanges')}                 style={btnLinkStyle}>Returns &amp; Exchanges</button></li>
              <li><button onClick={() => goTo('/shipping-info')}                     style={btnLinkStyle}>Shipping Info</button></li>
              <li><button onClick={() => goTo('/help-center')}                       style={btnLinkStyle}>Help Center</button></li>
              <li><button onClick={() => goTo('/delivery-shipping-policy')}          style={btnLinkStyle}>Delivery &amp; Shipping Policy</button></li>
              <li><button onClick={() => goTo('/return-refund-policy')}              style={btnLinkStyle}>Refund Policy</button></li>
            </ul>
          </div>

          {/* TWAM */}
          <div style={{ flex: '1 1 100px' }}>
            <h4 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: '#1a0a10' }}>TWAM</h4>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <li><button onClick={() => goTo('/about')}        style={btnLinkStyle}>Our Story</button></li>
              <li><button onClick={() => goTo('/our-blog')}     style={btnLinkStyle}>Blog</button></li>
              <li><button onClick={() => goTo('/twam-brands')}  style={btnLinkStyle}>TWAM Brands</button></li>
            </ul>
          </div>

          {/* Contact */}
          <div style={{ flex: '1 1 200px' }}>
            <h4 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: '#111' }}>Contact Information</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 10, fontSize: 13, color: '#555' }}>
                <i className="bi bi-geo-alt" style={{ color: '#6A012A', flexShrink: 0, marginTop: 2 }} />
                <span>GSM Mall, Miyapur Main Rd, ICRISAT Colony, Madeenaguda, Hyderabad, Telangana 500050</span>
              </div>
              <div style={{ display: 'flex', gap: 10, fontSize: 13, color: '#555' }}>
                <i className="bi bi-telephone" style={{ color: '#6A012A' }} />
                <span>+91 7036534449</span>
              </div>
              <div style={{ display: 'flex', gap: 10, fontSize: 13, color: '#555' }}>
                <i className="bi bi-envelope" style={{ color: '#6A012A' }} />
                <a href="mailto:customersupport@onlytwam.com" style={{ color: '#555', textDecoration: 'none' }}>
                  customersupport@onlytwam.com
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Bottom */}
      <div style={{ borderTop: '1px solid #eee', padding: '20px 0' }}>
        <div className="container" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>
            <p style={{ margin: 0, fontSize: 13, color: '#666' }}>
              © {currentYear} <strong>TWAM</strong>. All Rights Reserved.
            </p>
            <button onClick={() => goTo('/terms-conditions')} style={btnLinkStyle}>Terms &amp; Conditions</button>
            <button onClick={() => goTo('/privacy-policy')}   style={btnLinkStyle}>Privacy Policy</button>
          </div>

          {/* Social Icons */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            {[
              { href: 'https://www.facebook.com/onlyTwam/',                        icon: 'facebook.svg',  label: 'Facebook'  },
              { href: 'https://www.instagram.com/onlytwam/',                       icon: 'instagram.svg', label: 'Instagram' },
              { href: '#',                                                          icon: 'twitter.svg',   label: 'Twitter'   },
              { href: 'https://wa.link/y2zqo7',                                    icon: 'whatsapp.svg',  label: 'WhatsApp'  },
              { href: 'https://www.youtube.com/channel/UCHeGOyt3gARVUcWuYTvUdgg', icon: 'youtube.svg',   label: 'YouTube'   },
            ].map(s => (
              <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label}>
                <img src={`/assets/social/${s.icon}`} style={{ width: 22, height: 22 }} alt={s.label}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

const btnLinkStyle: React.CSSProperties = {
  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
  fontSize: 13, color: '#555', textAlign: 'left', fontFamily: 'inherit',
  display: 'block',
};