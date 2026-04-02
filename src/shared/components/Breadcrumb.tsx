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
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 900,
        background: 'var(--ivory)',
        borderBottom: '1.5px solid var(--heirloom)',
        padding: '6px 0',
        boxShadow: scrolled
          ? '0 3px 16px rgba(107,15,42,.13)'
          : '0 2px 8px rgba(107,15,42,.06)',
        transition: 'box-shadow .3s',
      }}
    >
      {/* Decorative gradient rule */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: 'linear-gradient(90deg, transparent 0%, var(--blush) 30%, var(--brand) 60%, transparent 100%)',
      }} />

      <div className="container">
        <ol style={{
          display: 'flex', alignItems: 'center', flexWrap: 'wrap',
          gap: '2px 2px', listStyle: 'none', margin: 0, padding: 0,
        }}>
          {items.map((item, i) => {
            const isLast = i === items.length - 1;
            return (
              <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {!isLast && item.path ? (
                  <Link
                    to={item.path}
                    style={{
                      fontSize: 12, color: 'var(--heirloom)', textDecoration: 'none',
                      fontFamily: 'var(--font-body)', fontWeight: 500, letterSpacing: 0.2,
                      padding: '2px 6px', borderRadius: 4,
                      transition: 'background .15s, color .15s',
                    }}
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
                      <i className="bi bi-house-fill" style={{ fontSize: 10, marginRight: 3 }} />
                    )}
                    {item.label}
                  </Link>
                ) : (
                  <span style={{
                    fontSize: 12, color: 'var(--brand)',
                    fontFamily: 'var(--font-body)', fontWeight: 700, letterSpacing: 0.3,
                    padding: '2px 8px', borderRadius: 4,
                    background: 'rgba(107,15,42,0.07)',
                    borderBottom: '1.5px solid var(--blush)',
                  }}>
                    {item.label}
                  </span>
                )}
                {!isLast && (
                  <i className="bi bi-chevron-right" style={{ fontSize: 8, color: 'rgba(158,96,112,0.5)' }} />
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
