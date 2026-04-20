import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/features/auth/store/authStore";
import UserAvatar from "@/shared/components/UserAvatar";
import { useWishlistStore } from "@/shared/store/wishlistStore";
import QuickCart from "@/features/cart/components/QuickCart";
import { getGuestWishlistCount } from "@/shared/utils/guestWishlist";
import toast from "react-hot-toast";

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

export default function MobileNavbar({
  showSearchHeader = true,
}: {
  showSearchHeader?: boolean;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, cartCount, hasValidToken, user, getUserName } =
    useAuthStore();
  const { serverIds: wishlistServerIds } = useWishlistStore();

  const [searchText, setSearchText] = useState("");
  const [showQuickCart, setShowQuickCart] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [hintIdx, setHintIdx] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const recRef = useRef<any>(null);

  const [guestCartCount, setGuestCartCount] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("guestCart") || "[]").length;
    } catch {
      return 0;
    }
  });

  const [guestWishlistCount, setGuestWishlistCount] = useState(
    getGuestWishlistCount,
  );

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 2);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const syncGuestCart = () => {
      try {
        setGuestCartCount(
          JSON.parse(localStorage.getItem("guestCart") || "[]").length,
        );
      } catch {
        setGuestCartCount(0);
      }
    };
    window.addEventListener("guestCartUpdated", syncGuestCart);
    return () => window.removeEventListener("guestCartUpdated", syncGuestCart);
  }, []);

  useEffect(() => {
    const syncGuestWishlist = () =>
      setGuestWishlistCount(getGuestWishlistCount());
    window.addEventListener("wishlistUpdated", syncGuestWishlist);
    return () =>
      window.removeEventListener("wishlistUpdated", syncGuestWishlist);
  }, []);

  useEffect(() => {
    if (location.pathname === "/global-search") {
      const q = new URLSearchParams(location.search).get("q") || "";
      setSearchText(q);
      return;
    }
    setSearchText("");
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (searchText || isListening) {
      setTypedText("");
      return;
    }

    const word = SEARCH_HINTS[hintIdx];
    const speed = isDeleting ? 60 : 110;
    const timer = setTimeout(() => {
      if (!isDeleting && typedText.length < word.length) {
        setTypedText(word.slice(0, typedText.length + 1));
        return;
      }
      if (!isDeleting && typedText.length === word.length) {
        setTimeout(() => setIsDeleting(true), 1400);
        return;
      }
      if (isDeleting && typedText.length > 0) {
        setTypedText(word.slice(0, typedText.length - 1));
        return;
      }
      setIsDeleting(false);
      setHintIdx((index) => (index + 1) % SEARCH_HINTS.length);
    }, speed);

    return () => clearTimeout(timer);
  }, [typedText, isDeleting, hintIdx, searchText, isListening]);

  const displayCartCount = hasValidToken() ? cartCount : guestCartCount;
  const displayWishlistCount = hasValidToken()
    ? wishlistServerIds.size
    : guestWishlistCount;

  const goHome = () => {
    if (location.pathname === "/" || location.pathname === "/home") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    navigate("/");
  };

  const goWishlist = () => {
    navigate("/wishlist", {
      state: { from: location.pathname + location.search },
    });
  };

  const goNotifications = () => {
    navigate(isAuthenticated ? "/account/notifications" : "/login");
  };

  const goAccount = () => {
    navigate(isAuthenticated ? "/account" : "/login");
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const q = searchText.trim();
    if (!q) return;
    navigate(`/global-search?q=${encodeURIComponent(q)}`);
  };

  const startVoice = () => {
    if (isListening) {
      recRef.current?.stop();
      recRef.current = null;
      setIsListening(false);
      return;
    }

    const SpeechRecognitionApi =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionApi) {
      toast.error("Voice search not supported on this device");
      return;
    }

    const recognition = new SpeechRecognitionApi();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);

    recognition.onend = () => {
      setIsListening(false);
      recRef.current = null;
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      recRef.current = null;
      if (event.error === "no-speech" || event.error === "aborted") return;
      toast.error("Voice search failed. Please try again.");
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript.trim();
      setSearchText(transcript);
      setTimeout(() => {
        navigate(`/global-search?q=${encodeURIComponent(transcript)}`);
      }, 250);
    };

    recRef.current = recognition;
    recognition.start();
  };

  const isHomeActive =
    location.pathname === "/" || location.pathname === "/home";
  const isWishlistActive =
    location.pathname === "/wishlist" ||
    location.pathname === "/account/wishlist";
  const isNotificationsActive = location.pathname === "/account/notifications";
  const isUserActive =
    location.pathname.startsWith("/account") && !isNotificationsActive;

  return (
    <>
      {showSearchHeader && (
        <header
          className={`mnb-header${isScrolled ? " mnb-header--scrolled" : ""}`}
        >
          <div className="mnb-row">
            <form
              className="mnb-search-shell"
              onSubmit={handleSearchSubmit}
              role="search"
            >
              <span className="mnb-search-logo-wrap" aria-hidden="true">
                <AssetImg
                  names={[
                    "/assets/mobile-logo.png",
                    "/assets/Twam-Logo-Burgundy.png",
                    "/assets/Twam-Logo-Black.png",
                    "/assets/TWAM.png",
                  ]}
                  alt="TWAM"
                  className="mnb-search-logo"
                />
              </span>

              <div className="mnb-search-form">
                <button
                  type="button"
                  className={`mnb-search-mic${
                    isListening ? " is-listening" : ""
                  }`}
                  onClick={startVoice}
                  aria-label={
                    isListening ? "Stop voice search" : "Voice search"
                  }
                >
                  <i
                    className={`bi ${
                      isListening ? "bi-stop-circle-fill" : "bi-mic-fill"
                    }`}
                  />
                </button>

                <div className="mnb-search-input-wrap">
                  {!searchText && (
                    <span
                      className={`mnb-search-hint${
                        isListening ? " is-listening" : ""
                      }`}
                    >
                      {isListening ? "Listening..." : typedText}
                      {!isListening && <span className="mnb-search-cursor" />}
                    </span>
                  )}

                  <input
                    type="search"
                    inputMode="search"
                    enterKeyHint="search"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    className="mnb-search-input"
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder=""
                    aria-label="Search products"
                  />
                </div>

                <button
                  type="submit"
                  className="mnb-search-submit"
                  aria-label="Search"
                >
                  <i className="bi bi-search" />
                </button>
              </div>
            </form>

            <div className="mnb-header-actions">
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
      )}

      <nav className="mnb-bottom-nav" aria-label="Mobile navigation">
        <button
          type="button"
          className={`mnb-bottom-nav__item${isHomeActive ? " is-active" : ""}`}
          onClick={goHome}
          aria-current={isHomeActive ? "page" : undefined}
        >
          <span className="mnb-bottom-nav__icon">
            <i
              className={`bi ${
                isHomeActive ? "bi-house-door-fill" : "bi-house-door"
              }`}
            />
          </span>
          <span className="mnb-bottom-nav__label">Home</span>
        </button>

        <button
          type="button"
          className={`mnb-bottom-nav__item${
            isWishlistActive ? " is-active" : ""
          }`}
          onClick={goWishlist}
          aria-current={isWishlistActive ? "page" : undefined}
        >
          <span className="mnb-bottom-nav__icon mnb-bottom-nav__icon--badge">
            <i
              className={`bi ${
                isWishlistActive ? "bi-heart-fill" : "bi-heart"
              }`}
            />
            {displayWishlistCount > 0 && (
              <span className="mnb-bottom-nav__badge">
                {displayWishlistCount}
              </span>
            )}
          </span>
          <span className="mnb-bottom-nav__label">Wishlist</span>
        </button>

        <button
          type="button"
          className={`mnb-bottom-nav__item${
            isNotificationsActive ? " is-active" : ""
          }`}
          onClick={goNotifications}
          aria-current={isNotificationsActive ? "page" : undefined}
        >
          <span className="mnb-bottom-nav__icon">
            <i
              className={`bi ${
                isNotificationsActive ? "bi-bell-fill" : "bi-bell"
              }`}
            />
          </span>
          <span className="mnb-bottom-nav__label">Alerts</span>
        </button>

        <button
          type="button"
          className={`mnb-bottom-nav__item${isUserActive ? " is-active" : ""}`}
          onClick={goAccount}
          aria-current={isUserActive ? "page" : undefined}
        >
          <span className="mnb-bottom-nav__icon">
            {isAuthenticated ? (
              <UserAvatar
                name={getUserName()}
                imageUrl={(user as any)?.profileImageUrl || ""}
                size={20}
                fallbackMode="initial"
                className="mnb-bottom-avatar"
                style={{
                  background: "var(--brand)",
                  color: "var(--white)",
                  border: "none",
                  boxShadow: "none",
                }}
              />
            ) : (
              <i className="bi bi-person" />
            )}
          </span>
          <span className="mnb-bottom-nav__label">
            {isAuthenticated ? "Account" : "Login"}
          </span>
        </button>
      </nav>

      {showQuickCart && <QuickCart onClose={() => setShowQuickCart(false)} />}
    </>
  );
}
