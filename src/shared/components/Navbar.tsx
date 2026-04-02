import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useWishlistStore } from '@/shared/store/wishlistStore';
import { useMenuStore } from '@/shared/store/menuStore';
import { getCategories } from '@/features/auth/api/auth.api';
import type { CategoryMenu } from '@/shared/types';
import QuickCart from '@/features/cart/components/QuickCart';
import { getGuestWishlistCount } from '@/shared/utils/guestWishlist';
import toast from 'react-hot-toast';

const TEXTS = [
  'Hello, Beautiful.', 'Welcome, Gorgeous.', 'You Are That.',
  'Step In, Shine On.', 'Confidence Looks Good On You.',
  'Ready to Find Your Perfect Fit?', 'Hello, Radiance.',
  'Welcome to Comfort, Welcome to Confidence.', 'You Belong Here.',
  'Your Journey to Comfort Starts Now.', 'Celebrate Yourself Today.',
  'Uncover the Real You.', 'Find What Makes You Feel Amazing.',
  'Beauty Begins Here.', 'Embrace Your Everyday Magic.',
  'Welcome to TWAM, Where You Are That.', 'Only TWAM — Confidence Starts Here.',
  'Step Into Comfort, Step Into TWAM.', 'You Are TWAM. You Are Enough.',
  'Be Bold. Be Beautiful. Be TWAM.', 'TWAM: The Real You, Unfiltered.',
];

const SEARCH_HINTS = ['Amante', 'panties', 'Enamor', 'padded bra', 'Jockey', 'seamless', 'Clovia', 'sports bra', 'red', 'wireless bra', 'Calvin Klein', 'Triumph', 'briefs'];
const PRI = '#6B0F2A';

function AssetImg({ names, alt, style, className }: { names: string[]; alt: string; style?: React.CSSProperties; className?: string }) {
  const [idx, setIdx] = useState(0);
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img src={names[idx]} alt={alt} style={style} className={className}
      onError={() => { if (idx < names.length - 1) setIdx(idx + 1); else setFailed(true); }} />
  );
}

export default function Navbar() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { isAuthenticated, getUserName, logout, cartCount, hasValidToken } = useAuthStore();
  const { serverIds: wishlistServerIds } = useWishlistStore();
  const { menus, setMenus } = useMenuStore();

  const [isScrolled,     setIsScrolled]    = useState(false);
  const [searchText,     setSearchText]    = useState('');
  const [searchFocused,  setSearchFocused] = useState(false);
  const [isMenuOpen,     setIsMenuOpen]    = useState(false);
  const [showQuickCart,  setShowQuickCart] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen]= useState(false);
  const [sloganIdx,   setSloganIdx]  = useState(0);
  const [sloganPhase, setSloganPhase] = useState<'in'|'hold'|'out'>('in');
  const [activeParent,   setActiveParent]  = useState<CategoryMenu | null>(null);
  const [showAllHover,   setShowAllHover]  = useState(false);
  const [hoveredCat,     setHoveredCat]    = useState<CategoryMenu | null>(null);

  // ── Typing animation state
  const [typedText,   setTypedText]   = useState('');
  const [hintIdx,     setHintIdx]     = useState(0);
  const [isDeleting,  setIsDeleting]  = useState(false);

  // ── Voice search
  const [isListening, setIsListening] = useState(false);

  const megaTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recRef      = useRef<any>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const drawerRef   = useRef<HTMLDivElement>(null);

  // ── Guest cart count
  const [guestCartCount, setGuestCartCount] = useState(() => {
    try { return JSON.parse(localStorage.getItem('guestCart') || '[]').length; } catch { return 0; }
  });
  useEffect(() => {
    const refresh = () => {
      try { setGuestCartCount(JSON.parse(localStorage.getItem('guestCart') || '[]').length); } catch { setGuestCartCount(0); }
    };
    window.addEventListener('guestCartUpdated', refresh);
    return () => window.removeEventListener('guestCartUpdated', refresh);
  }, []);

  // ── Guest wishlist count
  const [guestWishlistCount, setGuestWishlistCount] = useState(getGuestWishlistCount);
  useEffect(() => {
    const refresh = () => setGuestWishlistCount(getGuestWishlistCount());
    window.addEventListener('wishlistUpdated', refresh);
    return () => window.removeEventListener('wishlistUpdated', refresh);
  }, []);

  const displayCartCount     = hasValidToken() ? cartCount : guestCartCount;
  // For auth users, read live serverIds.size so any add/remove on any page reflects instantly
  const displayWishlistCount = hasValidToken() ? wishlistServerIds.size : guestWishlistCount;

  // ── Slogan slide-up + fade animation
  useEffect(() => {
    let t1: ReturnType<typeof setTimeout>;
    let t2: ReturnType<typeof setTimeout>;
    setSloganPhase('in');
    t1 = setTimeout(() => setSloganPhase('out'), 4500);       // hold 4.5s then fade out
    t2 = setTimeout(() => {
      setSloganIdx(i => (i + 1) % TEXTS.length);
      setSloganPhase('in');
    }, 5200);                                                    // 700ms for out transition
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [sloganIdx]);

  // ── Scroll shadow
  useEffect(() => {
    const fn = () => setIsScrolled(window.scrollY > 0);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  // ── Close user menu on outside click
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setIsUserMenuOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  useEffect(() => { if (!isMenuOpen) setActiveParent(null); }, [isMenuOpen]);

  // ── Load menus
  useEffect(() => {
    const cached = sessionStorage.getItem('menus');
    if (cached) { try { const p = JSON.parse(cached); if (p?.length) setMenus(p); } catch {} }
    getCategories({ roleId: 2 }).then(cats => {
      if (cats?.length) { setMenus(cats); sessionStorage.setItem('menus', JSON.stringify(cats)); }
    }).catch(() => {});
  }, []);

  // ── Typing animation — types each keyword char by char, deletes, moves to next
  useEffect(() => {
    if (searchFocused || searchText || isListening) { setTypedText(''); return; }
    const word    = SEARCH_HINTS[hintIdx];
    const speed   = isDeleting ? 60 : 110;
    const pauseMs = 1400;

    const t = setTimeout(() => {
      if (!isDeleting && typedText.length < word.length) {
        setTypedText(word.slice(0, typedText.length + 1));
      } else if (!isDeleting && typedText.length === word.length) {
        setTimeout(() => setIsDeleting(true), pauseMs);
      } else if (isDeleting && typedText.length > 0) {
        setTypedText(word.slice(0, typedText.length - 1));
      } else if (isDeleting && typedText.length === 0) {
        setIsDeleting(false);
        setHintIdx(i => (i + 1) % SEARCH_HINTS.length);
      }
    }, speed);
    return () => clearTimeout(t);
  }, [typedText, isDeleting, hintIdx, searchFocused, searchText]);

  // ── Voice search — toggle on/off, shows "Listening…" while active
  const startVoice = () => {
    // If already listening — stop
    if (isListening && recRef.current) {
      recRef.current.stop();
      recRef.current = null;
      setIsListening(false);
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast('Voice search not supported in this browser'); return; }
    const rec = new SR();
    rec.lang            = 'en-IN';
    rec.interimResults  = false;
    rec.maxAlternatives = 1;
    rec.onstart  = () => setIsListening(true);
    rec.onend    = () => { setIsListening(false); recRef.current = null; };
    rec.onerror  = () => { setIsListening(false); recRef.current = null; toast.error('Voice search failed. Try again.'); };
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript.trim();
      setSearchText(transcript);
      setTimeout(() => {
        setSearchText('');
        navigate(`/global-search?q=${encodeURIComponent(transcript)}`);
      }, 400);
    };
    recRef.current = rec;
    rec.start();
  };

  // ── Sync search bar with URL on GlobalSearch page, clear on other pages
  useEffect(() => {
    if (location.pathname === '/global-search') {
      const params = new URLSearchParams(location.search);
      const urlQ = params.get('q') || '';
      setSearchText(urlQ);
    } else {
      setSearchText('');
    }
  }, [location.pathname, location.search]);

  const handleLogout = () => { logout(); setIsUserMenuOpen(false); navigate('/'); };

  const onSearch = () => {
    const q = searchText.trim();
    if (!q) return;
    navigate(`/global-search?q=${encodeURIComponent(q)}`);
  };

  const goTo = (path: string) => { setIsMenuOpen(false); setActiveParent(null); navigate(path); };

  const reloadCategory = (cat: CategoryMenu) => {
    sessionStorage.setItem('categoryData', JSON.stringify({ title: cat.name, description: cat.about }));
    goTo(`/user-products/product-list/${cat.categoryId}`);
  };

  return (
    <>
      <style>{`
        @keyframes slideInLeft { from { transform: translateX(-20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes mic-pulse   { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.35); } }
        @keyframes cursor-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        .nav-search-input { caret-color: #6B0F2A; }
        .nav-search-input:focus { outline: none; }
      `}</style>

      <header style={{ position: 'sticky', top: 0, zIndex: 1000, background: '#F5F0E6', boxShadow: isScrolled ? '0 2px 16px rgba(107,15,42,.18)' : 'none', transition: 'box-shadow .3s' }}>

        {/* ── Top bar ── */}
        <div style={{ padding: '5px 0', background: '#F5F0E6' }}>
          <div className="container d-flex align-items-center">
            <div className="d-none d-md-flex align-items-center" style={{ gap: 12 }}>
              <Link to="/our-stores" style={{ background: '#fff', border: '1.5px solid #6B0F2A', padding: '6px 14px', borderRadius: 5, fontSize: 13, color: '#0f0f0f', fontFamily: 'inherit', fontWeight: 600, textDecoration: 'none' }}>Our Stores</Link>
              <Link to="/our-blog"   style={{ background: '#fff', border: '1.5px solid #6B0F2A', padding: '6px 14px', borderRadius: 5, fontSize: 13, color: '#0f0f0f', fontFamily: 'inherit', fontWeight: 600, textDecoration: 'none' }}>Our Blog</Link>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <span style={{
                fontSize: 12, color: '#6B0F2A', fontStyle: 'italic', fontWeight: 600,
                letterSpacing: 0.3, display: 'inline-block',
                opacity:   sloganPhase === 'hold' || sloganPhase === 'in' ? (sloganPhase === 'in' ? 1 : 1) : 0,
                transform: sloganPhase === 'in' ? 'translateY(0)' : sloganPhase === 'out' ? 'translateY(-8px)' : 'translateY(8px)',
                transition: sloganPhase === 'in'
                  ? 'opacity 0.5s ease, transform 0.5s ease'
                  : 'opacity 0.6s ease, transform 0.6s ease',
              }}>
                {TEXTS[sloganIdx]}
              </span>
            </div>
            <div className="d-none d-md-flex align-items-center" style={{ gap: 10 }}>
              <button onClick={() => navigate('/contact-us')} style={{ background: '#fff', border: '1.5px solid #6B0F2A', padding: '6px 14px', borderRadius: 5, cursor: 'pointer', fontSize: 13, color: '#0f0f0f', fontFamily: 'inherit', fontWeight: 600 }}>Contact Us</button>
              {!isAuthenticated && (
                <button onClick={() => navigate('/login')} style={{ background: '#6B0F2A', color: '#fff', border: '5px solid #fff', padding: '6px 16px', borderRadius: 5, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}>Sign In</button>
              )}
            </div>
          </div>
        </div>

        {/* ── Main header row ── */}
        <div style={{ padding: '8px 0', border: '4px solid #6B0F2A' }}>
          <div className="container d-flex align-items-center" style={{ gap: 12 }}>

            {/* Logo */}
            <Link to="/" style={{ flexShrink: 0 }}>
              <AssetImg names={['/assets/Twam-Logo-Black.png', '/assets/TWAM.png', '/assets/twam-logo.png']} alt="TWAM" style={{ height: 48, objectFit: 'contain' }} />
            </Link>

            {/* ── 3D Search bar ── */}
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '0 8px' }}>
              <div style={{
                position: 'relative', width: '100%', maxWidth: 500,
                display: 'flex', alignItems: 'center',
                background: '#ffffff',
                borderRadius: 28,
                border: `2px solid ${searchFocused ? '#6B0F2A' : 'rgba(107,15,42,.15)'}`,
                boxShadow: searchFocused
                  ? '0 4px 20px rgba(107,15,42,.22), 0 1px 0 rgba(255,255,255,.9) inset'
                  : '0 4px 14px rgba(107,15,42,.12), 0 1px 0 rgba(255,255,255,.9) inset',
                transition: 'box-shadow 0.25s, border-color 0.25s',
              }}>

                {/* Search icon — filled, always burgundy */}
                <button onClick={onSearch} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '0 4px 0 14px', display: 'flex', alignItems: 'center',
                  flexShrink: 0, zIndex: 2,
                }}>
                  <i className="bi bi-search" style={{ fontSize: 15, color: '#6B0F2A' }} />
                </button>

                {/* Placeholder: "Listening…" when mic active, typing animation otherwise */}
                {!searchText && (
                  <span style={{
                    position: 'absolute', left: 42, zIndex: 1,
                    fontSize: 14, pointerEvents: 'none',
                    fontFamily: 'inherit', whiteSpace: 'nowrap',
                    opacity: searchFocused ? 0 : 1,
                    transition: 'opacity 0.15s',
                    color: isListening ? '#6B0F2A' : '#9E6070',
                    fontStyle: isListening ? 'italic' : 'normal',
                    fontWeight: isListening ? 600 : 400,
                  }}>
                    {isListening ? (
                      <>
                        Listening…
                        <span style={{
                          display: 'inline-block', width: 8, height: 8,
                          borderRadius: '50%', background: '#6B0F2A',
                          marginLeft: 6, verticalAlign: 'middle',
                          animation: 'cursor-blink 0.8s step-end infinite',
                        }} />
                      </>
                    ) : (
                      <>
                        {typedText}
                        {!searchFocused && (
                          <span style={{
                            display: 'inline-block', width: 2, height: 14,
                            background: '#6B0F2A', marginLeft: 1, verticalAlign: 'middle',
                            animation: 'cursor-blink 0.8s step-end infinite',
                          }} />
                        )}
                      </>
                    )}
                  </span>
                )}

                {/* Input */}
                <input
                  className="nav-search-input"
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') onSearch(); }}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  placeholder={searchFocused ? 'Search products, brands, categories…' : ''}
                  style={{
                    flex: 1, padding: '10px 8px',
                    border: 'none', fontSize: 14, outline: 'none',
                    background: 'transparent', fontFamily: 'inherit',
                    color: '#1a0a10', minWidth: 0, zIndex: 2,
                  }}
                />

                {/* Mic button — pulses + shows stop icon when listening */}
                <button onClick={startVoice}
                  title={isListening ? 'Click to stop' : 'Search by voice'}
                  style={{
                    background: isListening ? 'rgba(107,15,42,.08)' : 'none',
                    border: 'none', cursor: 'pointer',
                    padding: '8px 14px', display: 'flex', alignItems: 'center',
                    flexShrink: 0, zIndex: 2, borderRadius: 20,
                    animation: isListening ? 'mic-pulse 0.9s ease infinite' : 'none',
                    transition: 'background 0.2s',
                  }}>
                  <i className={isListening ? 'bi bi-stop-circle-fill' : 'bi bi-mic-fill'}
                     style={{ fontSize: 16, color: '#6B0F2A' }} />
                </button>
              </div>
            </div>

            {/* Desktop category buttons */}
            <div className="d-none d-lg-flex" style={{ alignItems: 'center', gap: 0, overflow: 'hidden', maxWidth: 480 }}>
              {menus.slice(0, 7).map(cat => (
                <button key={cat.categoryId}
                  onMouseEnter={() => { if (megaTimer.current) clearTimeout(megaTimer.current); setHoveredCat(cat.children?.length > 0 ? cat : null); }}
                  onMouseLeave={() => { megaTimer.current = setTimeout(() => setHoveredCat(null), 200); }}
                  onClick={() => { reloadCategory(cat); setHoveredCat(null); }}
                  style={{ background: 'none', border: 'none', padding: '7px 10px', fontSize: 13, fontWeight: 500, color: hoveredCat?.categoryId === cat.categoryId ? '#6B0F2A' : '#444', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 2, transition: 'color .15s' }}>
                  {cat.name}
                  {cat.children?.length > 0 && <i className="bi bi-chevron-down" style={{ fontSize: 9, opacity: .5 }} />}
                </button>
              ))}
            </div>

            {/* Right icons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>

              {/* All products */}
              <button onClick={() => navigate('/user-products/product-list')} title="All Products"
                style={{ ...iconBtn, position: 'relative', width: 44, height: 44 }}
                onMouseEnter={() => setShowAllHover(true)}
                onMouseLeave={() => setShowAllHover(false)}>
                <i className="bi bi-grid-3x3-gap-fill" style={{ fontSize: 22 }} />
                <span style={{ position: 'absolute', bottom: -10, left: '50%', transform: 'translateX(-50%)', fontSize: 9, fontWeight: 600, color: '#333', whiteSpace: 'nowrap' }}>ALL</span>
                {showAllHover && (
                  <div style={{ position: 'absolute', top: -30, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap', background: '#333', color: '#fff', padding: '6px 12px', borderRadius: 4, fontSize: 11, fontWeight: 600, pointerEvents: 'none' }}>
                    Show All Products
                  </div>
                )}
              </button>

              {/* User / Login icon — always visible */}
              {!isAuthenticated ? (
                <button onClick={() => navigate('/login')} title="Sign In"
                  style={{ ...iconBtn, position: 'relative' }}>
                  <i className="bi bi-person-circle" style={{ fontSize: 24, color: '#6B0F2A' }} />
                </button>
              ) : (
                <div ref={userMenuRef} style={{ position: 'relative' }}>
                  <button onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} title="My Account"
                    style={{ ...iconBtn, position: 'relative' }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: `linear-gradient(135deg, #6B0F2A, #A84C6B)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: 13, fontWeight: 700,
                      boxShadow: '0 2px 8px rgba(107,15,42,.35)',
                    }}>
                      {getUserName()?.charAt(0)?.toUpperCase() || <i className="bi bi-person-fill" style={{ fontSize: 14 }} />}
                    </div>
                  </button>
                  {isUserMenuOpen && (
                    <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', background: '#fff', border: '1px solid #eee', borderRadius: 14, minWidth: 220, boxShadow: '0 12px 40px rgba(0,0,0,.14)', zIndex: 9999, overflow: 'hidden' }}>
                      {/* Header */}
                      <div style={{ padding: '16px 18px', background: 'linear-gradient(135deg,#6B0F2A,#A84C6B)', color: '#fff' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <div style={{ width:36, height:36, borderRadius:'50%', background:'rgba(255,255,255,0.25)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:700 }}>
                            {getUserName()?.charAt(0)?.toUpperCase()}
                          </div>
                          <div>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{getUserName()}</p>
                            <p style={{ margin: 0, fontSize: 11, opacity:0.8 }}>My Account</p>
                          </div>
                        </div>
                      </div>
                      <ul style={{ listStyle: 'none', margin: 0, padding: '6px 0' }}>
                        {[
                          { icon: 'bi-grid-1x2',          label: 'Dashboard',       path: '/account/dashboard' },
                          { icon: 'bi-person',             label: 'My Profile',      path: '/account/update-profile' },
                          { icon: 'bi-bag',                label: 'My Orders',       path: '/account/orders-list' },
                          { icon: 'bi-heart',              label: 'Wishlist',        path: '/wishlist' },
                          { icon: 'bi-geo-alt',            label: 'Addresses',       path: '/account/address-list' },
                          { icon: 'bi-ticket-perforated',  label: 'Coupons',         path: '/account/coupons-list' },
                          { icon: 'bi-bell',               label: 'Notifications',   path: '/account/notifications' },
                          { icon: 'bi-lock',               label: 'Change Password', path: '/account/change-password' },
                        ].map(item => (
                          <li key={item.path}>
                            <button onClick={() => { navigate(item.path); setIsUserMenuOpen(false); }}
                              style={{ width: '100%', background: 'none', border: 'none', padding: '10px 18px', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: '#333', fontFamily: 'inherit' }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#fdf5f7')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                              <i className={`bi ${item.icon}`} style={{ color: PRI, width: 16, fontSize: 14 }} /> {item.label}
                            </button>
                          </li>
                        ))}
                      </ul>
                      <div style={{ borderTop: '1px solid #f0f0f0', padding: '6px 0' }}>
                        <button onClick={handleLogout}
                          style={{ width: '100%', background: 'none', border: 'none', padding: '10px 18px', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: '#e53935', fontFamily: 'inherit' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#fff5f5')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                          <i className="bi bi-box-arrow-right" style={{ width:16 }} /> Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Wishlist */}
              <button onClick={() => navigate('/wishlist', { state: { from: location.pathname + location.search } })} title="My Wishlist"
                style={{ ...iconBtn, position: 'relative' }}>
                <i className="bi bi-heart-fill" style={{ fontSize: 24, color: '#6B0F2A' }} />
                {displayWishlistCount > 0 && <span style={badgeStyle}>{displayWishlistCount}</span>}
              </button>

              {/* Cart */}
              <button onClick={() => setShowQuickCart(true)} style={{ ...iconBtn, position: 'relative' }}>
                <i className="bi bi-cart-fill" style={{ fontSize: 24, color: '#6B0F2A' }} />
                {displayCartCount > 0 && <span style={badgeStyle}>{displayCartCount}</span>}
              </button>

              {/* Hamburger */}
              <button onClick={() => setIsMenuOpen(true)} style={{ ...iconBtn, marginLeft: 4 }}>
                <i className="bi bi-list" style={{ fontSize: 26 }} />
              </button>
            </div>
            </div>
        </div>
      </header>

      {/* Desktop mega menu */}
      {hoveredCat && hoveredCat.children?.length > 0 && (
        <div style={{ position: 'fixed', top: 112, left: 0, right: 0, background: '#fff', borderTop: '3px solid #6B0F2A', borderBottom: '1px solid #f0e6ea', boxShadow: '0 12px 40px rgba(107,15,42,.14)', zIndex: 997, padding: '20px 0 24px' }}
          onMouseEnter={() => { if (megaTimer.current) clearTimeout(megaTimer.current); }}
          onMouseLeave={() => { megaTimer.current = setTimeout(() => setHoveredCat(null), 150); }}>
          <div className="container">
            <p style={{ fontSize: 11, fontWeight: 700, color: '#9E6070', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 12px' }}>{hoveredCat.name}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 0' }}>
              <button onClick={() => { reloadCategory(hoveredCat); setHoveredCat(null); }}
                style={{ width: '24%', background: '#f5f0e6', border: 'none', padding: '9px 14px', fontSize: 13, fontWeight: 700, color: '#6B0F2A', cursor: 'pointer', borderRadius: 6, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, transition: 'background .15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#6B0F2A'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#f5f0e6'; e.currentTarget.style.color = '#6B0F2A'; }}>
                <i className="bi bi-grid-fill" style={{ fontSize: 10 }} /> Show All {hoveredCat.name}
              </button>
              {hoveredCat.children.map((sub: CategoryMenu) => (
                <button key={sub.categoryId} onClick={() => { reloadCategory(sub); setHoveredCat(null); }}
                  style={{ width: '24%', background: 'none', border: 'none', padding: '9px 14px', fontSize: 13, color: '#333', cursor: 'pointer', textAlign: 'left', borderRadius: 6, fontFamily: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background .15s, color .15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#fdf5f7'; e.currentTarget.style.color = '#6B0F2A'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#333'; }}>
                  {sub.name}
                  {sub.children?.length > 0 && <i className="bi bi-chevron-right" style={{ fontSize: 9, color: '#ccc' }} />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mobile two-panel drawer */}
      {isMenuOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.45)' }} onClick={() => setIsMenuOpen(false)} />
          <div ref={drawerRef} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, display: 'flex', zIndex: 9999, animation: 'slideInLeft .22s ease-out' }}>

            {/* Panel 1 */}
            <div style={{ width: 280, background: '#fff', display: 'flex', flexDirection: 'column', overflowY: 'auto', boxShadow: '4px 0 16px rgba(0,0,0,.1)' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <AssetImg names={['/assets/Twam-Logo-Black.png', '/assets/TWAM.png']} alt="TWAM" style={{ height: 36 }} />
                <button onClick={() => setIsMenuOpen(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#555', lineHeight: 1 }}>×</button>
              </div>
              <ul style={{ listStyle: 'none', margin: 0, padding: '8px 0', flex: 1 }}>
                {menus.map(cat => {
                  const hasSubs  = cat.children?.length > 0;
                  const isActive = activeParent?.categoryId === cat.categoryId;
                  return (
                    <li key={cat.categoryId}>
                      <div style={{ display: 'flex', alignItems: 'center', background: isActive ? '#fff5f7' : 'transparent', borderLeft: isActive ? `3px solid ${PRI}` : '3px solid transparent', transition: 'background .1s' }}
                        onMouseEnter={() => { hasSubs && setActiveParent(cat); }}>
                        <button onClick={() => { if (!hasSubs) reloadCategory(cat); else setActiveParent(isActive ? null : cat); }}
                          style={{ flex: 1, background: 'none', border: 'none', padding: '13px 16px 13px 14px', textAlign: 'left', cursor: 'pointer', fontSize: 14, fontWeight: isActive ? 700 : 500, color: isActive ? PRI : '#111', fontFamily: 'inherit' }}>
                          {cat.name}
                        </button>
                        {hasSubs && <span style={{ paddingRight: 14, color: isActive ? PRI : '#bbb', fontSize: 18, lineHeight: 1, userSelect: 'none' }}>›</span>}
                      </div>
                    </li>
                  );
                })}
                <li style={{ height: 1, background: '#f0f0f0', margin: '8px 0' }} />
                {[
                  { label: 'Our Stores', path: '/our-stores', icon: 'bi-shop' },
                  { label: 'Our Blog',   path: '/our-blog',   icon: 'bi-journal-text' },
                  { label: 'Contact Us', path: '/contact-us', icon: 'bi-envelope' },
                  { label: 'Size Guide', path: '/size-guide', icon: 'bi-rulers' },
                ].map(item => (
                  <li key={item.path}>
                    <button onClick={() => goTo(item.path)} style={{ width: '100%', background: 'none', border: 'none', padding: '11px 16px', textAlign: 'left', cursor: 'pointer', fontSize: 14, color: '#555', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <i className={`bi ${item.icon}`} style={{ fontSize: 15, color: '#aaa', width: 18 }} /> {item.label}
                    </button>
                  </li>
                ))}
              </ul>
              <div style={{ padding: 16, borderTop: '1px solid #eee', flexShrink: 0 }}>
                {!isAuthenticated ? (
                  <button onClick={() => goTo('/login')} style={{ width: '100%', background: '#6B0F2A', color: '#fff', border: 'none', padding: 12, borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 500, fontFamily: 'inherit' }}>Sign In / Register</button>
                ) : (
                  <button onClick={() => { handleLogout(); setIsMenuOpen(false); }} style={{ width: '100%', background: '#fff', color: '#A84C6B', border: '1px solid #A84C6B', padding: 12, borderRadius: 6, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>Sign Out</button>
                )}
              </div>
            </div>

            {/* Panel 2 — subcategories */}
            {activeParent && activeParent.children?.length > 0 && (
              <div style={{ width: 260, background: '#fdf5f7', display: 'flex', flexDirection: 'column', overflowY: 'auto', borderLeft: '1px solid #f0e0e5', animation: 'slideInLeft .18s ease-out' }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid #edd5dc', flexShrink: 0 }}>
                  <p style={{ margin: 0, fontSize: 11, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1 }}>{activeParent.name}</p>
                </div>
                <ul style={{ listStyle: 'none', margin: 0, padding: '8px 0', flex: 1 }}>
                  <li>
                    <button onClick={() => reloadCategory(activeParent)} style={{ width: '100%', background: 'none', border: 'none', padding: '11px 18px', textAlign: 'left', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: PRI, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #f5dde4' }}>
                      <i className="bi bi-grid-fill" style={{ fontSize: 11 }} /> Show All {activeParent.name}
                    </button>
                  </li>
                  {activeParent.children.map((sub: CategoryMenu) => {
                    const hasGC = sub.children?.length > 0;
                    return (
                      <li key={sub.categoryId}>
                        <button onClick={() => reloadCategory(sub)} style={{ width: '100%', background: 'none', border: 'none', padding: '11px 18px', textAlign: 'left', cursor: 'pointer', fontSize: 13, color: '#333', fontFamily: 'inherit', borderBottom: '1px solid #f5dde4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f8e8ed'; (e.currentTarget as HTMLElement).style.color = PRI; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = '#333'; }}>
                          <span>{sub.name}</span>
                          {hasGC && <i className="bi bi-chevron-right" style={{ fontSize: 10, color: '#ccc' }} />}
                        </button>
                        {hasGC && sub.children.map((gc: CategoryMenu) => (
                          <button key={gc.categoryId} onClick={() => reloadCategory(gc)}
                            style={{ width: '100%', background: 'none', border: 'none', padding: '9px 18px 9px 32px', textAlign: 'left', cursor: 'pointer', fontSize: 12, color: '#666', fontFamily: 'inherit', borderBottom: '1px solid #f5dde4' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f8e8ed'; (e.currentTarget as HTMLElement).style.color = PRI; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = '#666'; }}>
                            — {gc.name}
                          </button>
                        ))}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {showQuickCart && <QuickCart onClose={() => setShowQuickCart(false)} />}
    </>
  );
}

const iconBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', padding: 6,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: '50%', color: '#333', transition: 'color 0.2s',
};
const badgeStyle: React.CSSProperties = {
  position: 'absolute', top: -4, right: -4,
  background: '#6B0F2A', color: '#F5F0E6',
  borderRadius: '50%', width: 18, height: 18,
  fontSize: 10, fontWeight: 700,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};