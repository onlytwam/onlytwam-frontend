import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';

export interface Crumb { label: string; path?: string; }

/**
 * Breadcrumb
 *
 * – position: sticky so it sits exactly below whatever header precedes it in
 *   the DOM (Navbar is also sticky; two sticky elements stack naturally).
 * – No hard-coded `top` pixel value → works on every layout.
 * – No spacer div → the sticky element itself occupies flow space, so there
 *   is no gap / double-space between header and page content.
 * – Guards against empty `items` array (renders nothing).
 */

interface Props {
  items: Crumb[];
}

export default function Breadcrumb({ items }: Props) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  // Don't render at all if no crumbs are supplied
  if (!items || items.length === 0) return null;

  return (
    <nav
      aria-label="breadcrumb"
      className={`bc-nav s-breadcrumb-78155f${scrolled ? ' scrolled' : ''}`}
    >
      {/* Decorative gradient rule */}
      <div className="s-breadcrumb-123629" />

      <div className="container">
        <ol className="s-breadcrumb-c38630">
          {items.map((item, i) => {
            const isLast = i === items.length - 1;
            return (
              <li key={i} className="s-breadcrumb-a15059">
                {!isLast && item.path ? (
                  <Link
                    to={item.path}
                    className="s-breadcrumb-9555c8"
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(107,15,42,0.08)';
                      (e.currentTarget as HTMLElement).style.color = 'var(--brand)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                      (e.currentTarget as HTMLElement).style.color = 'var(--heirloom)';
                    }}
                  >
                    {i === 0 && (
                      <i className="bi bi-house-fill s-breadcrumb-a2eb90" />
                    )}
                    {item.label}
                  </Link>
                ) : (
                  <span className="s-breadcrumb-3f7a32">
                    {item.label}
                  </span>
                )}
                {!isLast && (
                  <i className="bi bi-chevron-right s-breadcrumb-256872" />
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
