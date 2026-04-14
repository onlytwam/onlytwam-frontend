/**
 * MobileCategoryBar.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Horizontal scrollable category tabs.
 * Positioning handled entirely by CSS position:sticky — no JS scroll logic.
 * Scrolls with page, sticks at top:64px when it reaches the header bottom.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import ReactDOM from "react-dom";
import type { CategoryMenu } from "@/shared/types";

interface Props {
  menus: CategoryMenu[];
}

// ── Zara-style 2-panel dropdown ──────────────────────────────────────────────
function ZaraDropdown({
  cat,
  onClose,
  onNavigate,
}: {
  cat: CategoryMenu;
  onClose: () => void;
  onNavigate: (c: CategoryMenu) => void;
}) {
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Catbar is always visible when user taps a pill (can't tap hidden catbar)
    // Catbar: top=64px, height=44px → bottom=108px always
    const drop = dropRef.current;
    if (drop) drop.style.top = "108px";
    const fn = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest(".mcb-dropdown") && !t.closest(".mcb-pill")) onClose();
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [onClose]);

  return ReactDOM.createPortal(
    <>
      <div className="mcb-backdrop" onClick={onClose} />
      <div className="mcb-dropdown" ref={dropRef}>
        <div className="mcb-dropdown__header">
          <span className="mcb-dropdown__cat-name">{cat.name}</span>
          <button
            className="mcb-dropdown__close"
            onClick={onClose}
            aria-label="Close"
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>
        <button
          className="mcb-dropdown__all-btn"
          onClick={() => onNavigate(cat)}
        >
          Shop all {cat.name} →
        </button>
        <div className="mcb-dropdown__grid">
          {cat.children.map((sub: CategoryMenu) => (
            <button
              key={sub.categoryId}
              className="mcb-dropdown__item"
              onClick={() => onNavigate(sub)}
            >
              {sub.name}
            </button>
          ))}
        </div>
      </div>
    </>,
    document.body,
  );
}

export default function MobileCategoryBar({ menus }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [openCat, setOpenCat] = useState<CategoryMenu | null>(null);

  useEffect(() => {
    setOpenCat(null);
  }, [location.pathname]);

  // ── Scroll handler: catbar hides/shows, toolbar tracks it ───────────────────
  // Both are position:fixed so this works at any scroll position on any page.
  // Scroll DOWN >4px  → catbar hides (translateY -100%), toolbar moves to top:64px
  // Scroll UP   >2px  → catbar shows (translateY 0),    toolbar moves to top:112px
  // Toolbar transition matches catbar (0.2s) — they move in sync, no gap.
  const wrapRef2 = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);
  const catHidden = useRef(false);

  const setToolbarTop = (catVisible: boolean) => {
    const toolbar = document.querySelector(
      ".product-toolbar",
    ) as HTMLElement | null;
    if (toolbar) toolbar.style.top = catVisible ? "108px" : "64px";
  };

  useEffect(() => {
    setToolbarTop(true); // initial state

    const onScroll = () => {
      // Pause if filter or sort drawer is open (body is fixed, scroll events are spurious)
      if ((window as any).__drawerOpen) return;
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const diff = y - lastScrollY.current;
        const cat = wrapRef2.current;

        if (diff > 4 && !catHidden.current) {
          catHidden.current = true;
          if (cat) cat.classList.add("mcb-wrapper--hidden");
          setToolbarTop(false); // toolbar moves up to 64px
          setOpenCat(null);
        } else if (diff < -2 && catHidden.current) {
          catHidden.current = false;
          if (cat) cat.classList.remove("mcb-wrapper--hidden");
          setToolbarTop(true); // toolbar moves down to 108px
        }

        lastScrollY.current = y;
        ticking.current = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const checkOverflow = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    checkOverflow();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkOverflow, { passive: true });
    window.addEventListener("resize", checkOverflow);
    return () => {
      el.removeEventListener("scroll", checkOverflow);
      window.removeEventListener("resize", checkOverflow);
    };
  }, [checkOverflow, menus]);

  const scrollRight = () => {
    scrollRef.current?.scrollBy({ left: 160, behavior: "smooth" });
  };

  // ── Navigation ────────────────────────────────────────────────────────────
  const goToCategory = (cat: CategoryMenu) => {
    sessionStorage.setItem(
      "categoryData",
      JSON.stringify({ title: cat.name, description: cat.about }),
    );
    navigate(`/user-products/product-list/${cat.categoryId}`);
    setOpenCat(null);
  };

  return (
    <div className="mcb-wrapper" ref={wrapRef2}>
      {/* Scrollable pill row */}
      <div className="mcb-track" ref={scrollRef}>
        <button
          className={`mcb-pill${
            location.pathname === "/user-products/product-list" &&
            !location.pathname.match(/product-list\/\d/)
              ? " mcb-pill--active"
              : ""
          }`}
          onClick={() => {
            setOpenCat(null);
            navigate("/user-products/product-list");
          }}
        >
          All
        </button>

        {menus.map((cat) => (
          <button
            key={cat.categoryId}
            className={`mcb-pill${
              openCat?.categoryId === cat.categoryId ||
              location.pathname.includes(`/${cat.categoryId}`)
                ? " mcb-pill--active"
                : ""
            }`}
            onClick={() => {
              if (!cat.children?.length) goToCategory(cat);
              else
                setOpenCat((prev) =>
                  prev?.categoryId === cat.categoryId ? null : cat,
                );
            }}
          >
            {cat.name}
            {cat.children?.length > 0 && (
              <i
                className={`bi bi-chevron-down mcb-pill-chevron${openCat?.categoryId === cat.categoryId ? " mcb-pill-chevron--open" : ""}`}
              />
            )}
          </button>
        ))}
      </div>

      {/* Right overflow arrow */}
      {canScrollRight && (
        <button
          className="mcb-scroll-arrow"
          onClick={scrollRight}
          aria-label="Scroll categories"
        >
          <i className="bi bi-chevron-right" />
        </button>
      )}

      {/* Zara-style 2-panel dropdown */}
      {openCat && openCat.children?.length > 0 && (
        <ZaraDropdown
          cat={openCat}
          onClose={() => setOpenCat(null)}
          onNavigate={goToCategory}
        />
      )}
    </div>
  );
}
