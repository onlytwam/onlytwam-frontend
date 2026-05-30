import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Link, useNavigate, useLocation, useParams } from "react-router-dom";
import { useAuthStore } from "@/features/auth/store/authStore";
import UserAvatar from "@/shared/components/UserAvatar";
import { useWishlistStore } from "@/shared/store/wishlistStore";
import { useMenuStore } from "@/shared/store/menuStore";
import type { CategoryMenu } from "@/shared/types";
import QuickCart from "@/features/cart/components/QuickCart";
import { getGuestWishlistCount } from "@/shared/utils/guestWishlist";
import toast from "react-hot-toast";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import MobileNavbar from "@/shared/components/MobileNavbar";
import MobileCategoryBar from "@/shared/components/MobileCategoryBar";
import { getCategories } from "@/features/auth/api/auth.api";

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

/**
 * SvgBadge — pixel-perfect badge identical in quality to Bootstrap icon glyphs.
 *
 * Key decisions:
 * 1. SVG not CSS — SVG renders via the vector engine (same as icon fonts).
 *    No blur from fractional parent widths.
 * 2. High internal resolution — viewBox is 4× the CSS pixel size.
 *    The browser rasterises 4× worth of detail then downscales on the GPU,
 *    giving the same crispness as a Retina/HiDPI display on any screen.
 * 3. Integer CSS size — width/height are whole px so the SVG origin
 *    always lands on a whole CSS pixel.
 * 4. geometricPrecision text — uses the full sub-pixel type hinter,
 *    same quality as browser UI chrome text.
 */
function SvgBadge({ count }: { count: number }) {
  const label = count > 99 ? "99+" : String(count);
  const isWide = label.length > 1;

  // CSS display size (whole pixels → integer origin)
  const W = isWide ? 22 : 18;
  const H = 18;

  // Internal viewBox at 4× for high-fidelity rasterisation
  const SCALE = 4;
  const VW = W * SCALE; // e.g. 72 or 88
  const VH = H * SCALE; // 72
  const RX = (H * SCALE) / 2; // fully rounded
  const SW = 1.5 * SCALE; // stroke width in viewBox units
  const FS = (isWide ? 9 : 10.5) * SCALE; // font size in viewBox units
  const cx = VW / 2;
  const cy = VH / 2;

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${VW} ${VH}`}
      aria-hidden="true"
      focusable="false"
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        /* translate(-25%, 25%) centres the badge on the icon's top-right
           corner — standard e-commerce badge placement */
        transform: "translate(25%, -25%)",
        pointerEvents: "none",
        display: "block",
        /* Prevent the browser ever rounding down detail during compositing */
        imageRendering: "pixelated" as any,
      }}
    >
      {/* Pill / circle — geometricPrecision for smooth anti-aliased curves */}
      <rect
        x={SW / 2}
        y={SW / 2}
        width={VW - SW}
        height={VH - SW}
        rx={RX - SW / 2}
        ry={RX - SW / 2}
        fill="var(--brand)"
        stroke="white"
        strokeWidth={SW}
        shapeRendering="geometricPrecision"
      />
      {/* Number — same rendering path as the icon font glyphs */}
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fill="white"
        fontSize={FS}
        fontWeight="900"
        fontFamily="system-ui, -apple-system, 'Segoe UI', Arial, sans-serif"
        textRendering="geometricPrecision"
        style={{ userSelect: "none" }}
      >
        {label}
      </text>
    </svg>
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
  const showMobileSearchHeader =
    location.pathname === "/" ||
    location.pathname === "/home" ||
    location.pathname.startsWith("/user-products/product-list") ||
    location.pathname.startsWith("/user-products/product-detail");
  const showMobileCategoryBar =
    location.pathname === "/" ||
    location.pathname === "/home" ||
    location.pathname.startsWith("/user-products/product-list");

  const isHomePage = location.pathname === "/" || location.pathname === "/home";

  // Detect which top-level category is currently active (including subcategories)
  const urlCategoryId = useMemo(() => {
    const match = location.pathname.match(
      /\/user-products\/product-list\/(\d+)/,
    );
    return match ? Number(match[1]) : null;
  }, [location.pathname]);

  const isCategoryActive = useCallback(
    (cat: CategoryMenu): boolean => {
      if (!urlCategoryId) return false;
      if (cat.categoryId === urlCategoryId) return true;
      const checkChildren = (children: CategoryMenu[]): boolean =>
        children?.some(
          (child) =>
            child.categoryId === urlCategoryId ||
            checkChildren(child.children ?? []),
        ) ?? false;
      return checkChildren(cat.children ?? []);
    },
    [urlCategoryId],
  );

  const [isScrolled, setIsScrolled] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showQuickCart, setShowQuickCart] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [guestCartCount, setGuestCartCount] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("guestCart") || "[]").length;
    } catch {
      return 0;
    }
  });
  const [guestWishlistCount, setGuestWishlistCount] = useState(
    getGuestWishlistCount(),
  );
  const [hoveredSidebarCat, setHoveredSidebarCat] =
    useState<CategoryMenu | null>(null);
  const [activeParent, setActiveParent] = useState<CategoryMenu | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [sloganIdx, setSloganIdx] = useState(0);
  const [sloganPhase, setSloganPhase] = useState<"in" | "out">("in");

  const sidebarHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recRef = useRef<any>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const userName = getUserName().trim() || (user as any)?.email || "Account";
  const profileImageUrl = (user as any)?.profileImageUrl || "";
  const displayCartCount = hasValidToken() ? cartCount : guestCartCount;
  const displayWishlistCount = hasValidToken()
    ? wishlistServerIds.size
    : guestWishlistCount;

  // Load menus: seed from sessionStorage immediately (avoids flash), then always
  // re-fetch live so that admin hide/unhide changes are reflected in real-time.
  useEffect(() => {
    // Seed from cache so the navbar renders immediately while the fetch is in flight.
    if (menus.length === 0) {
      const cached = sessionStorage.getItem("menus");
      if (cached) {
        try {
          const nextMenus = JSON.parse(cached);
          if (Array.isArray(nextMenus) && nextMenus.length > 0) {
            setMenus(nextMenus);
          }
        } catch {
          /* ignore malformed cache */
        }
      }
    }

    // Core fetch — always pulls fresh data and updates the store + sessionStorage.
    const fetchFresh = () => {
      getCategories({ roleId: 2 })
        .then((cats) => {
          if (Array.isArray(cats) && cats.length > 0) {
            sessionStorage.setItem("menus", JSON.stringify(cats));
            setMenus(cats);
          }
        })
        .catch(() => {
          /* silent */
        });
    };

    // Initial fetch on mount.
    fetchFresh();

    // -- Same-tab: CustomEvent dispatched by AdminCategories after a toggle --
    const onCategoriesUpdated = () => {
      sessionStorage.removeItem("menus");
      fetchFresh();
    };
    window.addEventListener("categoriesUpdated", onCategoriesUpdated);

    // -- Same-browser cross-tab: BroadcastChannel --
    // When admin hides/shows a category in the admin tab, it posts a message
    // on this channel. Every other open tab receives it and re-fetches
    // immediately — no polling needed for same-browser scenarios.
    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel("category_visibility");
      channel.onmessage = (e) => {
        if (e.data?.type === "CATEGORIES_UPDATED") {
          sessionStorage.removeItem("menus");
          fetchFresh();
        }
      };
    }

    // -- Cross-browser / mobile: re-fetch when tab becomes visible --
    // Covers the case where the admin changed a category in a different browser.
    // When the user switches back to this tab, we silently re-validate so
    // stale hidden categories disappear within one tab-focus — no reload needed.
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        sessionStorage.removeItem("menus");
        fetchFresh();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("categoriesUpdated", onCategoriesUpdated);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      channel?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 2);
    handleScroll();
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
    const syncGuestWishlist = () =>
      setGuestWishlistCount(getGuestWishlistCount());

    window.addEventListener("guestCartUpdated", syncGuestCart);
    window.addEventListener("wishlistUpdated", syncGuestWishlist);
    return () => {
      window.removeEventListener("guestCartUpdated", syncGuestCart);
      window.removeEventListener("wishlistUpdated", syncGuestWishlist);
    };
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  /* ── sync search with URL ───────────────────────────────── */
  useEffect(() => {
    if (location.pathname === "/global-search") {
      const q = new URLSearchParams(location.search).get("q") || "";
      setSearchText(q);
    } else {
      setSearchText("");
    }
  }, [location.pathname, location.search]);

  /* ── handlers ───────────────────────────────────────────── */
  if (isMobile) {
    return (
      <>
        <MobileNavbar showSearchHeader={showMobileSearchHeader} />
        {showMobileCategoryBar ? <MobileCategoryBar menus={menus} /> : null}
      </>
    );
  }

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
        className={`nb-header${
          isHomePage ? " nb-header--home" : " nb-header--solid"
        }${isScrolled ? " nb-header--scrolled" : ""}`}
      >
        <div className="nb-row">
          {/* Logo — left */}
          <Link
            to="/"
            className="nb-logo-wrap"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            <img
              src="/assets/Twam-Logo-White.png"
              alt="TWAM"
              className="nb-logo"
            />
          </Link>

          {/* Categories — inline */}
          {menus.length > 0 && (
            <nav className="nb-inline-cats">
              {menus.map((cat) => (
                <div key={cat.categoryId} className="nb-inline-cat__item">
                  <button
                    className={`nb-inline-cat__btn${
                      isCategoryActive(cat) ? " nb-inline-cat__btn--active" : ""
                    }`}
                    onClick={() => reloadCategory(cat)}
                  >
                    {cat.name}
                    {cat.children?.length > 0 && (
                      <i className="bi bi-chevron-down nb-inline-cat__arrow" />
                    )}
                  </button>
                  {cat.children?.length > 0 && (
                    <div className="nb-inline-cat__drop">
                      <div className="nb-inline-cat__drop-grid">
                        {cat.children.map((sub: any) => (
                          <button
                            key={sub.categoryId}
                            className="nb-inline-cat__sub"
                            onClick={() => reloadCategory(sub)}
                          >
                            {sub.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </nav>
          )}
          {/* Right side: search anchored 30px left of wishlist, then icon buttons */}
          <div className="nb-right">
            {/* Search — always visible, fixed position 30px left of wishlist */}
            <div
              className="nb-search-region nb-search-region--open nb-search-always"
              ref={searchRef}
            >
              <div className="nb-inline-search">
                <button
                  className={`nb-mic-btn${
                    isListening ? " nb-mic-btn--active" : ""
                  }`}
                  onClick={startVoice}
                  title={isListening ? "Stop" : "Voice search"}
                >
                  <i
                    className={`bi ${
                      isListening ? "bi-stop-circle-fill" : "bi-mic-fill"
                    }`}
                  />
                </button>
                <div className="nb-search-field-wrap">
                  <input
                    ref={searchInput}
                    className="nb-search-input"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onSearch();
                    }}
                    placeholder="What are you looking for?"
                  />
                </div>
                <button
                  className="nb-inline-search__submit"
                  onClick={onSearch}
                  aria-label="Search"
                >
                  <i className="bi bi-search" />
                </button>
              </div>
            </div>

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
                <SvgBadge count={displayWishlistCount} />
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
                  {profileImageUrl ? (
                    <img
                      src={profileImageUrl}
                      alt={userName}
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: "50%",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  ) : (
                    <span className="nb-initial-letter">
                      {userName.trim().charAt(0).toUpperCase() || "?"}
                    </span>
                  )}
                </button>

                {isUserMenuOpen && (
                  <div
                    className="nb-user-dropdown"
                    role="menu"
                    aria-label="Account options"
                  >
                    <div className="nb-user-dropdown__head">
                      <UserAvatar
                        name={userName}
                        imageUrl={profileImageUrl}
                        size={40}
                        fallbackMode="initial"
                        className="nb-user-dropdown__avatar"
                      />
                      <div className="nb-user-dropdown__copy">
                        <p className="nb-user-dropdown__name">{userName}</p>
                        <p className="nb-user-dropdown__sub">
                          Minimal account shortcuts
                        </p>
                      </div>
                    </div>
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
              onClick={() => setShowQuickCart((open) => !open)}
              data-quickcart-trigger="true"
              aria-label="Cart"
            >
              <i className="bi bi-bag" />
              {displayCartCount > 0 && <SvgBadge count={displayCartCount} />}
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
                      className={`nb-drawer__cat-row${
                        isActive ? " nb-drawer__cat-row--active" : ""
                      }`}
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
                          className={`nb-drawer__chevron${
                            isActive ? " nb-drawer__chevron--open" : ""
                          }`}
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
                  label: "Customer Support",
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
