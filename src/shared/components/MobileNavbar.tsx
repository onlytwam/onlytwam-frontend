/**
 * MobileNavbar.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Mobile-only header:
 *   LEFT:   search icon → opens full-screen dim overlay
 *   CENTER: TWAM logo + rotating tagline
 *   RIGHT:  wishlist · account · cart
 *
 * Search overlay:
 *   - Full screen dims to dark
 *   - TWAM logo glows faintly in center
 *   - Search bar at top with typing animation + voice
 *   - Submit → /global-search?q=...
 *   - Tap backdrop or back arrow → close, stay on page
 */

import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/features/auth/store/authStore";
import UserAvatar from "@/shared/components/UserAvatar";
import { useWishlistStore } from "@/shared/store/wishlistStore";
import QuickCart from "@/features/cart/components/QuickCart";
import { useOverlayBackDismiss } from "@/shared/hooks/useOverlayBackDismiss";
import { getGuestWishlistCount } from "@/shared/utils/guestWishlist";
import toast from "react-hot-toast";

const TEXTS = [
  "Hello, Beautiful.",
  "Welcome, Gorgeous.",
  "You Are That.",
  "Step In, Shine On.",
  "Confidence Looks Good On You.",
  "Ready to Find Your Perfect Fit?",
  "Hello, Radiance.",
  "Welcome to Comfort, Welcome to Confidence.",
  "You Belong Here.",
  "Your Journey to Comfort Starts Now.",
  "Celebrate Yourself Today.",
  "Uncover the Real You.",
  "Find What Makes You Feel Amazing.",
  "Beauty Begins Here.",
  "Embrace Your Everyday Magic.",
  "Welcome to TWAM, Where You Are That.",
  "Only TWAM — Confidence Starts Here.",
  "Step Into Comfort, Step Into TWAM.",
  "You Are TWAM. You Are Enough.",
  "Be Bold. Be Beautiful. Be TWAM.",
  "TWAM: The Real You, Unfiltered.",
];

const SEARCH_HINTS = [
  "Amante",
  "panties",
  "Enamor",
  "padded bra",
  "Jockey",
  "seamless",
  "Clovia",
  "sports bra",
  "wireless bra",
  "Triumph",
];

function AssetImg({
  names,
  alt,
  className,
}: {
  names: string[];
  alt: string;
  className?: string;
}) {
  const [idx, setIdx] = useState(0);
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={names[idx]}
      alt={alt}
      className={className}
      onError={() =>
        idx < names.length - 1 ? setIdx(idx + 1) : setFailed(true)
      }
    />
  );
}

// ── Full-screen search overlay ────────────────────────────────────────────────
function SearchOverlay({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { dismiss, dismissThen } = useOverlayBackDismiss(onClose);
  const [searchText, setSearchText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [hintIdx, setHintIdx] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<any>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []);

  // Scroll lock — position:fixed works in Capacitor WebView where overflow:hidden alone fails
  useEffect(() => {
    const scrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      document.body.style.overflow = "";
      window.scrollTo(0, scrollY); // restore scroll position
    };
  }, []);

  // Typing hint animation — same logic as desktop navbar
  useEffect(() => {
    if (searchText || isListening) {
      setTypedText("");
      return;
    }
    const word = SEARCH_HINTS[hintIdx];
    const speed = isDeleting ? 60 : 110;
    const t = setTimeout(() => {
      if (!isDeleting && typedText.length < word.length)
        setTypedText(word.slice(0, typedText.length + 1));
      else if (!isDeleting && typedText.length === word.length)
        setTimeout(() => setIsDeleting(true), 1400);
      else if (isDeleting && typedText.length > 0)
        setTypedText(word.slice(0, typedText.length - 1));
      else {
        setIsDeleting(false);
        setHintIdx((i) => (i + 1) % SEARCH_HINTS.length);
      }
    }, speed);
    return () => clearTimeout(t);
  }, [typedText, isDeleting, hintIdx, searchText, isListening]);

  const onSearch = () => {
    const q = searchText.trim();
    if (!q) return;
    dismissThen(() => navigate(`/global-search?q=${encodeURIComponent(q)}`));
  };

  const startVoice = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isListening && recRef.current) {
      recRef.current.stop();
      recRef.current = null;
      setIsListening(false);
      return;
    }
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast("Voice search not supported");
      return;
    }
    const rec = new SR();
    rec.lang = "en-IN";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onstart = () => setIsListening(true);
    rec.onend = () => {
      setIsListening(false);
      recRef.current = null;
    };
    rec.onerror = () => {
      setIsListening(false);
      recRef.current = null;
    };
    rec.onresult = (ev: any) => {
      const t = ev.results[0][0].transcript.trim();
      setSearchText(t);
      setTimeout(() => {
        dismissThen(() =>
          navigate(`/global-search?q=${encodeURIComponent(t)}`),
        );
      }, 300);
    };
    recRef.current = rec;
    rec.start();
  };

  return (
    /* Full-screen backdrop — click anywhere to close */
    <div className="mso-overlay" onClick={dismiss}>
      {/* Search bar row — stops propagation so tapping bar doesn't close */}
      <div className="mso-bar" onClick={(e) => e.stopPropagation()}>
        {/* Full-width pill: [🎤 | input | 🔍] */}
        <div className="mso-field-wrap">
          {/* Mic — inside left of search bar */}
          <button
            className={`mso-mic${isListening ? " mso-mic--active" : ""}`}
            onClick={startVoice}
            aria-label={isListening ? "Stop" : "Voice search"}
          >
            <i
              className={`bi ${
                isListening ? "bi-stop-circle-fill" : "bi-mic-fill"
              }`}
            />
          </button>

          {/* Input + typing hint */}
          <div className="mso-input-wrap">
            {!searchText && (
              <span
                className={`mso-hint${
                  isListening ? " mso-hint--listening" : ""
                }`}
              >
                {isListening ? "Listening…" : typedText}
                <span className="mso-cursor" />
              </span>
            )}
            <input
              ref={inputRef}
              className="mso-input"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSearch();
                if (e.key === "Escape") dismiss();
              }}
              placeholder=""
              autoComplete="off"
            />
          </div>

          {/* Search submit — inside right of search bar */}
          <button className="mso-submit" onClick={onSearch} aria-label="Search">
            <i className="bi bi-search" />
          </button>
        </div>

        {/* X close — outside right edge of search bar */}
        <button
          className="mso-close"
          onClick={dismiss}
          aria-label="Close search"
        >
          <i className="bi bi-x-lg" />
        </button>
      </div>

      {/* Ghost logo — barely visible in background */}
      <div className="mso-logo-center">
        <AssetImg
          names={[
            "/assets/Twam-Logo-Burgundy.png",
            "/assets/Twam-Logo-Black.png",
            "/assets/TWAM.png",
            "/assets/twam-logo.png",
          ]}
          alt="TWAM"
          className="mso-logo-ghost"
        />
      </div>
    </div>
  );
}

// ── MobileNavbar ──────────────────────────────────────────────────────────────
export default function MobileNavbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    isAuthenticated,
    getUserName,
    logout,
    cartCount,
    hasValidToken,
    user,
  } = useAuthStore();
  const { serverIds: wishlistServerIds } = useWishlistStore();

  const [searchOpen, setSearchOpen] = useState(false);
  const [showQuickCart, setShowQuickCart] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [sloganIdx, setSloganIdx] = useState(0);
  const [sloganPhase, setSloganPhase] = useState<"in" | "out">("in");
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSloganPhase("in");
    const t1 = setTimeout(() => setSloganPhase("out"), 4000);
    const t2 = setTimeout(() => {
      setSloganIdx((i) => (i + 1) % TEXTS.length);
      setSloganPhase("in");
    }, 4700);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [sloganIdx]);

  useEffect(() => {
    const fn = () => setIsScrolled(window.scrollY > 2);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      )
        setIsUserMenuOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const [guestCartCount, setGuestCartCount] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("guestCart") || "[]").length;
    } catch {
      return 0;
    }
  });
  useEffect(() => {
    const fn = () => {
      try {
        setGuestCartCount(
          JSON.parse(localStorage.getItem("guestCart") || "[]").length,
        );
      } catch {
        setGuestCartCount(0);
      }
    };
    window.addEventListener("guestCartUpdated", fn);
    return () => window.removeEventListener("guestCartUpdated", fn);
  }, []);

  const [guestWishlistCount, setGuestWishlistCount] = useState(
    getGuestWishlistCount,
  );
  useEffect(() => {
    const fn = () => setGuestWishlistCount(getGuestWishlistCount());
    window.addEventListener("wishlistUpdated", fn);
    return () => window.removeEventListener("wishlistUpdated", fn);
  }, []);

  const displayCartCount = hasValidToken() ? cartCount : guestCartCount;
  const displayWishlistCount = hasValidToken()
    ? wishlistServerIds.size
    : guestWishlistCount;
  const userName = getUserName();
  const profileImageUrl = (user as any)?.profileImageUrl || "";

  return (
    <>
      <header
        className={`mnb-header${isScrolled ? " mnb-header--scrolled" : ""}`}
      >
        <div className="mnb-row">
          <div className="mnb-left">
            <button
              className="mnb-icon-btn"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
            >
              <i className="bi bi-search" />
            </button>
          </div>

          <Link
            to="/"
            className="mnb-logo-wrap"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            <AssetImg
              names={[
                "/assets/Twam-Logo-Burgundy.png",
                "/assets/Twam-Logo-Black.png",
                "/assets/TWAM.png",
                "/assets/twam-logo.png",
              ]}
              alt="TWAM"
              className="mnb-logo"
            />
            <p
              className={`mnb-tagline ${
                sloganPhase === "in" ? "is-visible" : "is-hidden"
              }`}
            >
              {TEXTS[sloganIdx]}
            </p>
          </Link>

          <div className="mnb-right">
            <button
              className="mnb-icon-btn mnb-icon-relative"
              onClick={() =>
                navigate("/wishlist", {
                  state: { from: location.pathname + location.search },
                })
              }
              aria-label="Wishlist"
            >
              <i className="bi bi-heart" />
              {displayWishlistCount > 0 && (
                <span className="mnb-badge">{displayWishlistCount}</span>
              )}
            </button>

            {!isAuthenticated ? (
              <button
                className="mnb-icon-btn mnb-signin-btn"
                onClick={() => navigate("/login")}
                aria-label="Sign in"
              >
                <i className="bi bi-person" />
              </button>
            ) : (
              <div ref={userMenuRef} className="mnb-user-wrap">
                <button
                  className="mnb-icon-btn"
                  onClick={() => setIsUserMenuOpen((o) => !o)}
                  aria-label="Account"
                >
                  <UserAvatar
                    name={userName}
                    imageUrl={profileImageUrl}
                    size={30}
                    fallbackMode="initial"
                    className="mnb-avatar"
                    style={{
                      background: "var(--brand)",
                      color: "var(--white)",
                      border: "none",
                      boxShadow: "none",
                    }}
                  />
                </button>
                {isUserMenuOpen && (
                  <div
                    className="mnb-user-dropdown"
                    role="menu"
                    aria-label="Account options"
                  >
                    <div className="mnb-user-menu">
                      <button
                        type="button"
                        className="mnb-user-menu__item"
                        onClick={() => {
                          navigate("/account");
                          setIsUserMenuOpen(false);
                        }}
                      >
                        <i className="bi bi-person" /> Account
                      </button>
                      <button
                        type="button"
                        className="mnb-user-menu__signout"
                        onClick={() => {
                          logout();
                          setIsUserMenuOpen(false);
                          navigate("/");
                        }}
                      >
                        <i className="bi bi-box-arrow-right" /> Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              className="mnb-icon-btn mnb-icon-relative"
              onClick={() => setShowQuickCart((open) => !open)}
              data-quickcart-trigger="true"
              aria-label="Cart"
            >
              <i className="bi bi-bag" />
              {displayCartCount > 0 && (
                <span className="mnb-badge">{displayCartCount}</span>
              )}
            </button>
          </div>
        </div>
      </header>

      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
      {showQuickCart && <QuickCart onClose={() => setShowQuickCart(false)} />}
    </>
  );
}
