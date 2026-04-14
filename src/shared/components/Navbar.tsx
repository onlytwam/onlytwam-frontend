import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/features/auth/store/authStore";
import UserAvatar from "@/shared/components/UserAvatar";
import { useWishlistStore } from "@/shared/store/wishlistStore";
import { useMenuStore } from "@/shared/store/menuStore";
import { getCategories } from "@/features/auth/api/auth.api";
import type { CategoryMenu } from "@/shared/types";
import QuickCart from "@/features/cart/components/QuickCart";
import { getGuestWishlistCount } from "@/shared/utils/guestWishlist";
import toast from "react-hot-toast";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import MobileNavbar from "@/shared/components/MobileNavbar";
import MobileCategoryBar from "@/shared/components/MobileCategoryBar";

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

export default function Navbar() {
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
  const { menus, setMenus } = useMenuStore();

  // On mobile: delegate to MobileNavbar + MobileCategoryBar
  const isMobile = useIsMobile();

  const [isScrolled, setIsScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showQuickCart, setShowQuickCart] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [hoveredSidebarCat, setHoveredSidebarCat] =
    useState<CategoryMenu | null>(null);
  const [activeParent, setActiveParent] = useState<CategoryMenu | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [hintIdx, setHintIdx] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [sloganIdx, setSloganIdx] = useState(0);
  const [sloganPhase, setSloganPhase] = useState<"in" | "out">("in");

  const sidebarHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recRef = useRef<any>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);

  /* ── guest cart count ──────────────────────────────────── */
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

  /* ── body scroll lock when sidebar open ────────────────── */
  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMenuOpen]);

  /* ── slogan cycle ───────────────────────────────────────── */
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

  /* ── scroll shadow ──────────────────────────────────────── */
  useEffect(() => {
    const fn = () => setIsScrolled(window.scrollY > 2);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  /* ── outside-click: user menu ───────────────────────────── */
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

  /* ── outside-click: search ──────────────────────────────── */
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Ignore clicks on the right icons area or the search bar itself
      if (target.closest(".nb-right") || target.closest(".nb-search-region")) {
        return;
      }

      // Close only if there's no text typed
      if (!searchText) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [searchText]);

  /* ── auto-focus ─────────────────────────────────────────── */
  useEffect(() => {
    if (searchOpen) setTimeout(() => searchInput.current?.focus(), 60);
  }, [searchOpen]);

  /* ── load menus — runs on both mobile and desktop ─────── */
  useEffect(() => {
    const cached = sessionStorage.getItem("menus");
    if (cached) {
      try {
        const p = JSON.parse(cached);
        if (p?.length) setMenus(p);
      } catch {}
    }
    getCategories({ roleId: 2 })
      .then((cats) => {
        if (cats?.length) {
          setMenus(cats);
          sessionStorage.setItem("menus", JSON.stringify(cats));
        }
      })
      .catch(() => {});
  }, []);

  // Mobile: render dedicated mobile components, skip desktop render
  if (isMobile) {
    return (
      <>
        <MobileNavbar />
        <MobileCategoryBar menus={menus} />
      </>
    );
  }

  /* ── typing hint ────────────────────────────────────────── */
  useEffect(() => {
    if (!searchOpen || searchText || isListening) {
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
  }, [typedText, isDeleting, hintIdx, searchOpen, searchText, isListening]);

  /* ── sync search with URL ───────────────────────────────── */
  useEffect(() => {
    if (location.pathname === "/global-search") {
      const q = new URLSearchParams(location.search).get("q") || "";
      setSearchText(q);
      if (q) setSearchOpen(true);
    } else {
      setSearchText("");
    }
  }, [location.pathname, location.search]);

  /* ── handlers ───────────────────────────────────────────── */
  const handleLogout = () => {
    logout();
    setIsUserMenuOpen(false);
    navigate("/");
  };

  const onSearch = () => {
    const q = searchText.trim();
    if (!q) return;
    navigate(`/global-search?q=${encodeURIComponent(q)}`);
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchText("");
  };

  const reloadCategory = (cat: CategoryMenu) => {
    sessionStorage.setItem(
      "categoryData",
      JSON.stringify({ title: cat.name, description: cat.about }),
    );
    setIsMenuOpen(false);
    setHoveredSidebarCat(null);
    setActiveParent(null);
    navigate(`/user-products/product-list/${cat.categoryId}`);
  };

  const startVoice = () => {
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
      toast.error("Voice search failed.");
    };
    rec.onresult = (e: any) => {
      const t = e.results[0][0].transcript.trim();
      setSearchText(t);
      setTimeout(() => {
        navigate(`/global-search?q=${encodeURIComponent(t)}`);
      }, 300);
    };
    recRef.current = rec;
    rec.start();
  };

  /* ══════════════════════════════════════════════════════════
      RENDER
  ══════════════════════════════════════════════════════════ */

  /* ── Desktop layout ─────────────────────────────────────────────────────── */
  return (
    <>
      <header
        className={`nb-header${isScrolled ? " nb-header--scrolled" : ""}`}
      >
        <div className="nb-row">
          {/* Left Side: Menu + All Products Button */}
          <div className="nb-left">
            <button
              className="nb-icon-btn nb-menu-btn"
              onClick={() => setIsMenuOpen(true)}
              aria-label="Open menu"
            >
              <i className="bi bi-list" />
            </button>
            <button
              className="nb-all-products-btn"
              onClick={() => navigate("/user-products/product-list")}
            >
              All Products
            </button>
          </div>

          {/* Absolute Centered Logo - Fully Clickable */}
          <Link
            to="/"
            className="nb-logo-wrap"
            onClick={() => {
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            <AssetImg
              names={[
                "/assets/Twam-Logo-Burgundy.png",
                "/assets/TWAM.png",
                "/assets/twam-logo.png",
              ]}
              alt="TWAM"
              className="nb-logo"
            />
            <p
              className={`nb-tagline ${sloganPhase === "in" ? "is-visible" : "is-hidden"}`}
            >
              {TEXTS[sloganIdx]}
            </p>
          </Link>

          {/* Search Box */}
          <div
            ref={searchRef}
            className={`nb-search-region${searchOpen ? " nb-search-region--open" : ""}`}
          >
            <div className="nb-inline-search">
              {/* Mic Icon moved to left */}
              <button
                className={`nb-mic-btn${isListening ? " nb-mic-btn--active" : ""}`}
                onClick={startVoice}
                title={isListening ? "Stop" : "Voice search"}
              >
                <i
                  className={`bi ${isListening ? "bi-stop-circle-fill" : "bi-mic-fill"}`}
                />
              </button>

              <div className="nb-search-field-wrap">
                {!searchText && (
                  <span
                    className={`nb-search-hint${isListening ? " nb-search-hint--listening" : ""}`}
                  >
                    {isListening ? "Listening…" : typedText}
                    <span className="nb-cursor" />
                  </span>
                )}
                <input
                  ref={searchInput}
                  className="nb-search-input"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onSearch();
                    if (e.key === "Escape" && !searchText) closeSearch();
                  }}
                  placeholder=""
                />
              </div>

              {/* Search Icon moved to right and made clickable */}
              <button
                className="nb-inline-search__submit"
                onClick={onSearch}
                title="Search"
                aria-label="Submit search"
              >
                <i className="bi bi-search" />
              </button>
            </div>
          </div>

          {/* Right Icons */}
          <div className="nb-right">
            {/* Search Toggle Icon */}
            <button
              className="nb-icon-btn"
              onClick={(e) => {
                e.stopPropagation();
                if (searchOpen) {
                  closeSearch();
                } else {
                  setSearchOpen(true);
                }
              }}
              aria-label={searchOpen ? "Close search" : "Search"}
            >
              <i className={`bi ${searchOpen ? "bi-x-lg" : "bi-search"}`} />
            </button>

            {/* Wishlist */}
            <button
              className="nb-icon-btn nb-icon-relative"
              onClick={() =>
                navigate("/wishlist", {
                  state: { from: location.pathname + location.search },
                })
              }
              aria-label="Wishlist"
            >
              <i className="bi bi-heart" />
              {displayWishlistCount > 0 && (
                <span className="nb-badge">{displayWishlistCount}</span>
              )}
            </button>

            {/* User */}
            {!isAuthenticated ? (
              <button
                className="nb-icon-btn nb-login-btn"
                onClick={() => navigate("/login")}
                aria-label="Sign in"
              >
                <i className="bi bi-person" />
              </button>
            ) : (
              <div ref={userMenuRef} className="nb-user-wrap">
                <button
                  className="nb-icon-btn nb-user-btn"
                  onClick={() => setIsUserMenuOpen((open) => !open)}
                  aria-label="Account"
                  aria-expanded={isUserMenuOpen}
                  aria-haspopup="menu"
                >
                  <UserAvatar
                    name={userName}
                    imageUrl={profileImageUrl}
                    size={48}
                    fallbackMode="initial"
                    className="nb-avatar"
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
                    className="nb-user-dropdown"
                    role="menu"
                    aria-label="Account options"
                  >
                    <div className="nb-user-menu">
                      <button
                        type="button"
                        className="nb-user-menu__item"
                        onClick={() => {
                          navigate("/account/dashboard");
                          setIsUserMenuOpen(false);
                        }}
                      >
                        <i className="bi bi-grid-1x2" /> User Dashboard
                      </button>
                      <button
                        type="button"
                        className="nb-user-menu__signout"
                        onClick={handleLogout}
                      >
                        <i className="bi bi-box-arrow-right" /> Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Cart */}
            <button
              className="nb-icon-btn nb-icon-relative"
              onClick={() => setShowQuickCart(true)}
              aria-label="Cart"
            >
              <i className="bi bi-bag" />
              {displayCartCount > 0 && (
                <span className="nb-badge">{displayCartCount}</span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ── Sidebar overlay ──────────────────────────────────── */}
      {isMenuOpen && (
        <div className="nb-overlay">
          <div
            className="nb-overlay__backdrop"
            onClick={() => {
              setIsMenuOpen(false);
              setActiveParent(null);
              setHoveredSidebarCat(null);
            }}
          />

          <div className="nb-drawer">
            <div className="nb-drawer__head">
              <span className="nb-drawer__head-title">Menu</span>
              <button
                className="nb-drawer__close"
                onClick={() => {
                  setIsMenuOpen(false);
                  setActiveParent(null);
                  setHoveredSidebarCat(null);
                }}
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>

            {/* Account header shown at top if authenticated */}
            {isAuthenticated && (
              <div className="nb-drawer__account">
                <UserAvatar
                  name={userName}
                  imageUrl={profileImageUrl}
                  size={38}
                  fallbackMode="initial"
                  className="nb-drawer__avatar"
                  style={{
                    background: "rgba(255, 255, 255, 0.22)",
                    color: "var(--white)",
                    border: "1px solid rgba(255, 255, 255, 0.22)",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.12)",
                  }}
                />
                <div>
                  <p className="nb-drawer__username">{userName}</p>
                  <button
                    className="nb-drawer__view-account"
                    onClick={() => {
                      navigate("/account/dashboard");
                      setIsMenuOpen(false);
                    }}
                  >
                    View Account →
                  </button>
                </div>
              </div>
            )}

            <ul className="nb-drawer__menu">
              {menus.map((cat) => {
                const hasSubs = cat.children?.length > 0;
                const isActive = activeParent?.categoryId === cat.categoryId;
                return (
                  <li key={cat.categoryId}>
                    <div
                      className={`nb-drawer__cat-row${isActive ? " nb-drawer__cat-row--active" : ""}`}
                      onMouseEnter={() => {
                        if (hasSubs) {
                          if (sidebarHoverTimer.current)
                            clearTimeout(sidebarHoverTimer.current);
                          setHoveredSidebarCat(cat);
                        }
                      }}
                      onMouseLeave={() => {
                        if (hasSubs)
                          sidebarHoverTimer.current = setTimeout(
                            () => setHoveredSidebarCat(null),
                            200,
                          );
                      }}
                    >
                      <button
                        className="nb-drawer__cat-btn"
                        onClick={() => {
                          if (!hasSubs) reloadCategory(cat);
                          else setActiveParent(isActive ? null : cat);
                        }}
                      >
                        {cat.name}
                      </button>
                      {hasSubs && (
                        <span
                          className={`nb-drawer__chevron${isActive ? " nb-drawer__chevron--open" : ""}`}
                        >
                          <i className="bi bi-chevron-right" />
                        </span>
                      )}
                    </div>

                    {isActive && hasSubs && (
                      <ul className="nb-drawer__subs">
                        <li>
                          <button
                            className="nb-drawer__sub-all"
                            onClick={() => reloadCategory(cat)}
                          >
                            <i className="bi bi-grid-fill" /> All {cat.name}
                          </button>
                        </li>
                        {cat.children.map((sub: CategoryMenu) => (
                          <li key={sub.categoryId}>
                            <button
                              className="nb-drawer__sub-item"
                              onClick={() => reloadCategory(sub)}
                            >
                              {sub.name}
                              {sub.children?.length > 0 && (
                                <i className="bi bi-chevron-right" />
                              )}
                            </button>
                            {sub.children?.map((gc: CategoryMenu) => (
                              <button
                                key={gc.categoryId}
                                className="nb-drawer__grand-item"
                                onClick={() => reloadCategory(gc)}
                              >
                                — {gc.name}
                              </button>
                            ))}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="nb-drawer__links">
              {[
                { label: "Our Stores", path: "/our-stores", icon: "bi-shop" },
                {
                  label: "Our Blog",
                  path: "/our-blog",
                  icon: "bi-journal-text",
                },
                {
                  label: "Contact Us",
                  path: "/contact-us",
                  icon: "bi-envelope",
                },
                { label: "Size Guide", path: "/size-guide", icon: "bi-rulers" },
              ].map((item) => (
                <button
                  key={item.path}
                  className="nb-drawer__link-btn"
                  onClick={() => {
                    navigate(item.path);
                    setIsMenuOpen(false);
                  }}
                >
                  <i className={`bi ${item.icon}`} /> {item.label}
                </button>
              ))}
            </div>

            {/* Bottom section: Sign out if auth, otherwise Sign in */}
            <div className="nb-drawer__signout-wrap">
              {isAuthenticated ? (
                <button
                  className="nb-drawer__signout-btn"
                  onClick={() => {
                    handleLogout();
                    setIsMenuOpen(false);
                  }}
                >
                  Sign Out
                </button>
              ) : (
                <button
                  className="nb-drawer__signin-btn"
                  onClick={() => {
                    navigate("/login");
                    setIsMenuOpen(false);
                  }}
                >
                  Sign In / Register
                </button>
              )}
            </div>
          </div>

          {hoveredSidebarCat && hoveredSidebarCat.children?.length > 0 && (
            <div
              className="nb-subcats-panel"
              onMouseEnter={() => {
                if (sidebarHoverTimer.current)
                  clearTimeout(sidebarHoverTimer.current);
              }}
              onMouseLeave={() => {
                sidebarHoverTimer.current = setTimeout(
                  () => setHoveredSidebarCat(null),
                  200,
                );
              }}
            >
              <div className="nb-subcats-panel__inner">
                <p className="nb-subcats-panel__label">
                  {hoveredSidebarCat.name}
                </p>

                <button
                  className="nb-subcats-panel__view-all"
                  onClick={() => {
                    reloadCategory(hoveredSidebarCat);
                    setHoveredSidebarCat(null);
                  }}
                >
                  <i className="bi bi-grid-fill" /> Show All{" "}
                  {hoveredSidebarCat.name}
                </button>

                <div className="nb-subcats-panel__grid">
                  {hoveredSidebarCat.children.map((sub: CategoryMenu) => (
                    <div key={sub.categoryId} className="nb-subcat-group">
                      <button
                        className="nb-subcat-group__title"
                        onClick={() => {
                          reloadCategory(sub);
                          setHoveredSidebarCat(null);
                        }}
                      >
                        {sub.name}
                        {sub.children?.length > 0 && (
                          <i className="bi bi-chevron-right" />
                        )}
                      </button>
                      {sub.children && sub.children.length > 0 && (
                        <ul className="nb-subcat-group__items">
                          {sub.children.map((gc: CategoryMenu) => (
                            <li key={gc.categoryId}>
                              <button
                                className="nb-subcat-item"
                                onClick={() => {
                                  reloadCategory(gc);
                                  setHoveredSidebarCat(null);
                                }}
                              >
                                {gc.name}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {showQuickCart && <QuickCart onClose={() => setShowQuickCart(false)} />}
    </>
  );
}
