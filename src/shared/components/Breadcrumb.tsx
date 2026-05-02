import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

export interface Crumb {
  label: string;
  path?: string;
}

/**
 * Breadcrumb
 *
 * – position: sticky so it sits exactly below whatever header precedes it in
 * the DOM (Navbar is also sticky; two sticky elements stack naturally).
 * – No hard-coded `top` pixel value → works on every layout.
 * – No spacer div → the sticky element itself occupies flow space, so there
 * is no gap / double-space between header and page content.
 * – Guards against empty `items` array (renders nothing).
 */

interface Props {
  items: Crumb[];
  contextLabel?: string;
}

export default function Breadcrumb({ items, contextLabel }: Props) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  // Don't render at all if no crumbs are supplied
  if (!items || items.length === 0) return null;

  return (
    <nav
      aria-label="breadcrumb"
      className={`bc-nav ${scrolled ? "scrolled" : ""}`}
    >
      <div className="container bc-shell">
        <ol className="bc-list">
          {items.map((item, i) => {
            const isLast = i === items.length - 1;
            return (
              <li key={i} style={{ display: "flex", alignItems: "center" }}>
                {!isLast && item.path ? (
                  <Link to={item.path} className="bc-link">
                    {i === 0 && (
                      <i
                        className="bi bi-house-fill"
                        style={{ marginRight: "6px", fontSize: "12px" }}
                      />
                    )}
                    {item.label}
                  </Link>
                ) : (
                  <span className="bc-current">
                    {i === 0 && (
                      <i
                        className="bi bi-house-fill"
                        style={{ marginRight: "6px", fontSize: "12px" }}
                      />
                    )}
                    {item.label}
                  </span>
                )}

                {/* Separator icon shown after every item except the last */}
                {!isLast && <i className="bi bi-chevron-right bc-sep" />}
              </li>
            );
          })}
        </ol>
        {contextLabel ? (
          <span className="bc-context-tag" aria-label={`${contextLabel} mode`}>
            <i className="bi bi-bag-check-fill" aria-hidden="true" />
            {contextLabel}
          </span>
        ) : null}
      </div>
    </nav>
  );
}
