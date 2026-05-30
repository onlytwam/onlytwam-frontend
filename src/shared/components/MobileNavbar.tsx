import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/features/auth/store/authStore";
import UserAvatar from "@/shared/components/UserAvatar";
import { useWishlistStore } from "@/shared/store/wishlistStore";
import QuickCart from "@/features/cart/components/QuickCart";
import { getGuestWishlistCount } from "@/shared/utils/guestWishlist";
import toast from "react-hot-toast";
import { Capacitor } from "@capacitor/core";

const SEARCH_HINTS = [
  "Amante",
  "panties",
  "Enamor",
  "padded bra",
  "Soie",
  "seamless",
  "TWAM",
  "sports bra",
  "wireless bra",
  "Triumph",
];

const VOICE_PAUSE_MS = 4000;

function getNativeSpeech() {
  return (window as any)?.Capacitor?.Plugins?.NativeSpeech ?? null;
}

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

  const webRecRef = useRef<any>(null);
  const nativeListenersRef = useRef<any[]>([]);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmedTextRef = useRef<string>("");
  const isListeningRef = useRef(false);

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

  // ── Scroll listener ──────────────────────────────────────────────────────
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 2);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // ── Guest cart sync ──────────────────────────────────────────────────────
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

  // ── Guest wishlist sync ──────────────────────────────────────────────────
  useEffect(() => {
    const syncGuestWishlist = () =>
      setGuestWishlistCount(getGuestWishlistCount());
    window.addEventListener("wishlistUpdated", syncGuestWishlist);
    return () =>
      window.removeEventListener("wishlistUpdated", syncGuestWishlist);
  }, []);

  // ── Sync search text with URL ────────────────────────────────────────────
  useEffect(() => {
    if (location.pathname === "/global-search") {
      const q = new URLSearchParams(location.search).get("q") || "";
      setSearchText(q);
      confirmedTextRef.current = q;
      return;
    }
    setSearchText("");
    confirmedTextRef.current = "";
  }, [location.pathname, location.search]);

  // ── Typewriter hint animation ────────────────────────────────────────────
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
      setHintIdx((i) => (i + 1) % SEARCH_HINTS.length);
    }, speed);
    return () => clearTimeout(timer);
  }, [typedText, isDeleting, hintIdx, searchText, isListening]);

  const displayCartCount = hasValidToken() ? cartCount : guestCartCount;
  const displayWishlistCount = hasValidToken()
    ? wishlistServerIds.size
    : guestWishlistCount;

  // ── Navigation helpers ───────────────────────────────────────────────────
  const goHome = () => {
    if (location.pathname === "/" || location.pathname === "/home") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    navigate("/");
  };

  const goWishlist = () =>
    navigate("/wishlist", {
      state: { from: location.pathname + location.search },
    });

  const goNotifications = () =>
    navigate(isAuthenticated ? "/notifications" : "/login");

  const goAccount = () => navigate(isAuthenticated ? "/account" : "/login");

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const q = searchText.trim();
    if (!q) return;
    navigate(`/global-search?q=${encodeURIComponent(q)}`);
  };

  // ── Timer helpers ────────────────────────────────────────────────────────
  const clearPauseTimer = () => {
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
  };

  const resetPauseTimer = () => {
    clearPauseTimer();
    pauseTimerRef.current = setTimeout(fullyStop, VOICE_PAUSE_MS);
  };

  // ── Listener cleanup ─────────────────────────────────────────────────────
  const removeNativeListeners = () => {
    nativeListenersRef.current.forEach((h) => {
      try {
        h.remove();
      } catch (_) {}
    });
    nativeListenersRef.current = [];
  };

  // ── Stop everything ──────────────────────────────────────────────────────
  function fullyStop() {
    clearPauseTimer();
    isListeningRef.current = false;
    const ns = getNativeSpeech();
    if (ns) {
      removeNativeListeners();
      try {
        ns.stop();
      } catch (_) {}
    }
    if (webRecRef.current) {
      try {
        webRecRef.current.stop();
      } catch (_) {}
      webRecRef.current = null;
    }
    setIsListening(false);
    confirmedTextRef.current = searchText;
  }

  // ── Native (APK) session ─────────────────────────────────────────────────
  // FIX 1: ns.addListener not cap.addListener (Capacitor 3+ correct API)
  // FIX 2: auto-navigate on final transcript instead of just setting state
  const startNativeSession = () => {
    const ns = getNativeSpeech();
    if (!ns) {
      startWebVoice();
      return;
    }

    removeNativeListeners();

    const resultHandle = ns.addListener(
      "onResult",
      (data: { transcript: string; isFinal: boolean }) => {
        if (!isListeningRef.current) return;

        const transcript = (data.transcript ?? "").trim();

        if (data.isFinal) {
          const updated = (confirmedTextRef.current + " " + transcript).trim();
          confirmedTextRef.current = updated;
          setSearchText(updated);
          // Stop mic and auto-navigate to search results
          fullyStop();
          if (updated) {
            navigate(`/global-search?q=${encodeURIComponent(updated)}`);
          }
        } else if (transcript) {
          // Show interim text in search bar while still recording
          setSearchText((confirmedTextRef.current + " " + transcript).trim());
          resetPauseTimer();
        }
      },
    );

    const errorHandle = ns.addListener(
      "onError",
      (data: { error: string; fatal: boolean }) => {
        if (!isListeningRef.current) return;
        if (data.fatal) {
          toast.error(`Voice error: ${data.error}`);
          fullyStop();
        }
        // non-fatal errors ignored — Android already handled retry
      },
    );

    const statusHandle = ns.addListener(
      "onStatus",
      (_data: { status: string }) => {
        // speechEnd fires when Android stops recording.
        // We simply wait — onResult arrives next with the transcript.
      },
    );

    nativeListenersRef.current = [resultHandle, errorHandle, statusHandle];

    ns.start({ language: "en-IN" }).catch((e: any) => {
      toast.error(`Could not start mic: ${e?.message || e}`);
      fullyStop();
    });
  };

  // ── Web (browser) voice ──────────────────────────────────────────────────
  const startWebVoice = () => {
    const SpeechRecognitionApi =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionApi) {
      toast.error("Voice search not supported on this device");
      fullyStop();
      return;
    }

    const recognition = new SpeechRecognitionApi();
    recognition.lang = "en-IN";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event: any) => {
      let interim = "";
      let final_ = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) final_ += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (final_) {
        const updated = (confirmedTextRef.current + " " + final_).trim();
        confirmedTextRef.current = updated;
        setSearchText(updated);
        fullyStop();
        if (updated) {
          navigate(`/global-search?q=${encodeURIComponent(updated)}`);
        }
      } else if (interim) {
        setSearchText((confirmedTextRef.current + " " + interim).trim());
      }
      resetPauseTimer();
    };

    recognition.onend = () => {
      webRecRef.current = null;
      if (isListeningRef.current) {
        setTimeout(() => {
          if (isListeningRef.current) startWebVoice();
        }, 150);
      } else {
        setIsListening(false);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      toast.error(`Voice error: ${event.error}`);
      fullyStop();
    };

    webRecRef.current = recognition;
    recognition.start();
  };

  // ── Start / stop mic ─────────────────────────────────────────────────────
  const startVoice = async () => {
    if (isListeningRef.current) {
      fullyStop();
      return;
    }

    confirmedTextRef.current = searchText.trim();
    isListeningRef.current = true;
    setIsListening(true);
    resetPauseTimer();

    if (Capacitor.isNativePlatform()) {
      const ns = getNativeSpeech();
      if (ns) {
        try {
          const result = await ns.isAvailable();
          if (!result?.available) {
            toast("Voice search is not available on this device.", {
              duration: 5000,
            });
            fullyStop();
            return;
          }
        } catch (_) {
          // isAvailable check failed — try anyway
        }
        startNativeSession();
      } else {
        startWebVoice();
      }
    } else {
      startWebVoice();
    }
  };

  const clearSearch = () => {
    fullyStop();
    setSearchText("");
    confirmedTextRef.current = "";
  };

  // ── Active state helpers ─────────────────────────────────────────────────
  const isHomeActive =
    location.pathname === "/" || location.pathname === "/home";
  const isWishlistActive = location.pathname === "/wishlist";
  const isNotificationsActive = location.pathname === "/notifications";
  const isUserActive = location.pathname.startsWith("/account");
  const showHeaderBackButton = showSearchHeader && !isHomeActive;

  const handleHeaderBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/");
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      {showSearchHeader && (
        <header
          className={`mnb-header${isScrolled ? " mnb-header--scrolled" : ""}${
            showHeaderBackButton ? " mnb-header--with-back" : ""
          }`}
        >
          <div
            className={`mnb-row${showHeaderBackButton ? " mnb-row--with-back" : ""}`}
          >
            {showHeaderBackButton && (
              <button
                type="button"
                className="checkout-mobile-back mnb-header__back"
                onClick={handleHeaderBack}
                aria-label="Go back"
              >
                <i className="bi bi-chevron-left" />
              </button>
            )}
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
                  {!searchText && !isListening && (
                    <span className="mnb-search-hint">
                      {typedText}
                      <span className="mnb-search-cursor" />
                    </span>
                  )}
                  {!searchText && isListening && (
                    <span className="mnb-search-hint is-listening">
                      Listening...
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
                    onChange={(e) => {
                      setSearchText(e.target.value);
                      confirmedTextRef.current = e.target.value;
                    }}
                    placeholder=""
                    aria-label="Search products"
                  />
                </div>

                {searchText ? (
                  <button
                    type="button"
                    className="mnb-search-clear"
                    onClick={clearSearch}
                    aria-label="Clear search"
                  >
                    <i className="bi bi-x-lg" />
                  </button>
                ) : null}

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
                onClick={() => setShowQuickCart((o) => !o)}
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
