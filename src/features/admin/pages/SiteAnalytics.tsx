// ─────────────────────────────────────────────────────────────
// FILE: src/features/admin/pages/SiteAnalytics.tsx
// ─────────────────────────────────────────────────────────────
import React, { useState, useEffect } from "react";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import AnalyticsDashboard from "../utils/AnalyticsDashboard";

const HARDCODED_PROPERTY_ID = "";
const HARDCODED_ACCESS_TOKEN = "";
const BACKEND_TOKEN_URL = "";

export default function SiteAnalytics() {
  const [propertyId, setPropertyId] = useState(HARDCODED_PROPERTY_ID);
  const [accessToken, setAccessToken] = useState(HARDCODED_ACCESS_TOKEN);
  const [ready, setReady] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (HARDCODED_PROPERTY_ID && HARDCODED_ACCESS_TOKEN) {
      setReady(true);
      return;
    }
    if (BACKEND_TOKEN_URL) {
      fetchFromBackend();
    }
  }, []);

  async function fetchFromBackend() {
    try {
      setFetching(true);
      const res = await fetch(BACKEND_TOKEN_URL);
      const data = await res.json();
      if (data.token && data.propertyId) {
        setAccessToken(data.token);
        setPropertyId(data.propertyId);
        setReady(true);
      } else {
        setErr("Backend didn't return token/propertyId");
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setFetching(false);
    }
  }

  function handleManualSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!propertyId.trim() || !accessToken.trim()) {
      setErr("Both fields are required.");
      return;
    }
    setErr("");
    setReady(true);
  }

  if (ready) {
    return (
      <AnalyticsDashboard
        propertyId={propertyId}
        accessToken={accessToken}
        onLogout={() => setReady(false)}
      />
    );
  }

  return (
    <SetupScreen
      propertyId={propertyId}
      setPropertyId={setPropertyId}
      accessToken={accessToken}
      setAccessToken={setAccessToken}
      onSubmit={handleManualSubmit}
      fetching={fetching}
      err={err}
    />
  );
}

interface SetupScreenProps {
  propertyId: string;
  setPropertyId: (v: string) => void;
  accessToken: string;
  setAccessToken: (v: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  fetching: boolean;
  err: string;
}

function SetupScreen({
  propertyId,
  setPropertyId,
  accessToken,
  setAccessToken,
  onSubmit,
  fetching,
  err,
}: SetupScreenProps) {
  const [showToken, setShowToken] = useState(false);
  return (
    <div style={s.root}>
      <div style={s.card}>
        <div style={s.logo}>
          <span style={s.dot} />
          OnlyTWAM Analytics
        </div>
        <p style={s.tagline}>
          Connect your Google Analytics 4 account to see live data
        </p>
        <div style={s.steps}>
          <Step n="1" title="Get your GA4 Property ID">
            Go to{" "}
            <a
              href="https://analytics.google.com"
              target="_blank"
              rel="noreferrer"
              style={s.link}
            >
              analytics.google.com
            </a>
            {" → "} Admin → Property Settings → copy the numeric{" "}
            <b style={{ color: "#ccc" }}>Property ID</b> (e.g. 320123456)
          </Step>
          <Step n="2" title="Get an Access Token (for testing)">
            Go to{" "}
            <a
              href="https://developers.google.com/oauthplayground"
              target="_blank"
              rel="noreferrer"
              style={s.link}
            >
              OAuth Playground
            </a>
            {" → "}paste{" "}
            <code style={s.code}>
              https://www.googleapis.com/auth/analytics.readonly
            </code>
            {" → "} Authorize → Exchange → copy{" "}
            <b style={{ color: "#ccc" }}>Access token</b>
            <div style={s.note}>
              ⚠ Tokens expire in ~1 hour. For production, set{" "}
              <code style={s.code}>BACKEND_TOKEN_URL</code> at the top of this
              file.
            </div>
          </Step>
          <Step n="3" title="Paste both values below and connect" />
        </div>
        <form onSubmit={onSubmit} style={s.form}>
          <label style={s.label}>GA4 Property ID</label>
          <input
            style={s.input}
            type="text"
            placeholder="320123456"
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            autoFocus
          />
          <label style={{ ...s.label, marginTop: 16 }}>Access Token</label>
          <div style={{ position: "relative" }}>
            <input
              style={{
                ...s.input,
                paddingRight: 64,
                fontFamily: "monospace",
                fontSize: 11,
              }}
              type={showToken ? "text" : "password"}
              placeholder="ya29.a0AfB_byTK..."
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
            />
            <button
              type="button"
              style={s.eyeBtn}
              onClick={() => setShowToken((v) => !v)}
            >
              {showToken ? "Hide" : "Show"}
            </button>
          </div>
          {err && <div style={s.err}>⚠ {err}</div>}
          <button type="submit" style={s.submitBtn} disabled={fetching}>
            {fetching ? "Connecting…" : "Connect & Open Dashboard →"}
          </button>
        </form>
        <div style={s.footer}>
          For permanent production access without re-pasting tokens, use a
          backend service account endpoint.
        </div>
      </div>
    </div>
  );
}

interface StepProps {
  n: string;
  title: string;
  children?: ReactNode;
}
function Step({ n, title, children }: StepProps) {
  return (
    <div style={s.step}>
      <div style={s.stepNum}>{n}</div>
      <div style={{ flex: 1 }}>
        <div style={s.stepTitle}>{title}</div>
        {children && <div style={s.stepBody}>{children}</div>}
      </div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  root: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'DM Sans', system-ui, sans-serif",
    padding: 24,
  },
  card: {
    background: "#161616",
    border: "1px solid #222",
    borderRadius: 16,
    padding: "36px 40px",
    width: "100%",
    maxWidth: 560,
  },
  logo: {
    fontSize: 22,
    fontWeight: 600,
    color: "#f0ede8",
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
    letterSpacing: "-0.02em",
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: "50%",
    background: "#e8a598",
    display: "inline-block",
  },
  tagline: { fontSize: 13, color: "#555", marginBottom: 28 },
  steps: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    marginBottom: 28,
  },
  step: { display: "flex", gap: 12, alignItems: "flex-start" },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: "50%",
    background: "#2a2a2a",
    border: "1px solid #333",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    fontWeight: 600,
    color: "#e8a598",
    flexShrink: 0,
    marginTop: 1,
  },
  stepTitle: { fontSize: 13, fontWeight: 500, color: "#ccc", marginBottom: 4 },
  stepBody: { fontSize: 12, color: "#666", lineHeight: 1.7 },
  note: {
    marginTop: 8,
    fontSize: 11,
    color: "#7a5a40",
    background: "#1e1510",
    border: "1px solid #3a2a1a",
    borderRadius: 6,
    padding: "7px 10px",
    lineHeight: 1.6,
  },
  link: { color: "#e8a598", textDecoration: "none" },
  code: {
    fontFamily: "monospace",
    fontSize: 11,
    background: "#1e1e1e",
    padding: "1px 5px",
    borderRadius: 4,
    color: "#aaa",
  },
  form: { display: "flex", flexDirection: "column" },
  label: {
    fontSize: 11,
    fontWeight: 600,
    color: "#555",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  input: {
    background: "#1a1a1a",
    border: "1px solid #2a2a2a",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    color: "#f0ede8",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  eyeBtn: {
    position: "absolute",
    right: 10,
    top: "50%",
    transform: "translateY(-50%)",
    background: "transparent",
    border: "none",
    color: "#555",
    fontSize: 11,
    cursor: "pointer",
    padding: "2px 6px",
  },
  err: {
    marginTop: 10,
    fontSize: 12,
    color: "#c87070",
    background: "#1e1010",
    border: "1px solid #3a1818",
    borderRadius: 6,
    padding: "8px 12px",
  },
  submitBtn: {
    marginTop: 20,
    padding: "12px 20px",
    background: "#e8a598",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    color: "#1a0a08",
    cursor: "pointer",
    letterSpacing: "-0.01em",
  },
  footer: {
    marginTop: 20,
    fontSize: 11,
    color: "#3a3a3a",
    textAlign: "center",
  },
};
