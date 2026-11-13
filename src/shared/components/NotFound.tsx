// src/shared/components/NotFound.tsx
//
// Shown for any URL that does not match a page. The server also answers these
// URLs with HTTP status 404 (dist/404.html, see staticwebapp.config.json).
import { useEffect } from "react";
import { Link } from "react-router-dom";

export default function NotFound() {
  // Tell the route spinner and the pre-render script that this page is ready.
  useEffect(() => {
    window.dispatchEvent(new Event("page-content-ready"));
  }, []);

  return (
    <section
      className="container"
      style={{ padding: "80px 16px", textAlign: "center" }}
    >
      <title>Page not found | TWAM</title>
      <meta name="robots" content="noindex, follow" />

      <h1 style={{ fontSize: 32, marginBottom: 12, color: "var(--brand)" }}>
        Page not found
      </h1>
      <p style={{ marginBottom: 28, color: "#666" }}>
        The page you are looking for does not exist or may have moved.
      </p>

      <div
        style={{
          display: "flex",
          gap: 12,
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        <Link
          to="/"
          style={{
            background: "var(--brand)",
            color: "#fff",
            padding: "10px 22px",
            borderRadius: 6,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Go to home
        </Link>
        <Link
          to="/new-arrivals"
          style={{
            border: "1px solid var(--brand)",
            color: "var(--brand)",
            padding: "10px 22px",
            borderRadius: 6,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Shop all products
        </Link>
      </div>
    </section>
  );
}

//update