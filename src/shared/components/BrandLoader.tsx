import { useEffect, useState } from "react";

export const HOME_INITIAL_LOAD_FLAG = "twam-home-initial-loader-seen";

const BRAND_LOADER_TEXT = "Where comfort meets confidence.";
const BRAND_LOGOS = [
  "/assets/Twam-Logo-Burgundy.png",
  "/assets/TWAM.png",
  "/assets/twam-logo.png",
];

export default function BrandLoader({
  showBranding = false,
  fullScreen = false,
}: {
  showBranding?: boolean;
  fullScreen?: boolean;
}) {
  const [typedText, setTypedText] = useState(showBranding ? "" : BRAND_LOADER_TEXT);
  const [logoIndex, setLogoIndex] = useState(0);
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    if (!showBranding) {
      setTypedText(BRAND_LOADER_TEXT);
      return;
    }

    if (typedText.length >= BRAND_LOADER_TEXT.length) return;
    const timeout = window.setTimeout(() => {
      setTypedText(BRAND_LOADER_TEXT.slice(0, typedText.length + 1));
    }, 55);

    return () => window.clearTimeout(timeout);
  }, [showBranding, typedText]);

  useEffect(() => {
    if (!fullScreen || typeof document === "undefined") return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [fullScreen]);

  return (
    <div
      className={`brand-loader${fullScreen ? " brand-loader--fullscreen" : ""}${showBranding ? " brand-loader--branded" : " brand-loader--compact"}`}
      aria-live="polite"
      aria-busy="true"
    >
      {showBranding && !logoFailed && (
        <img
          src={BRAND_LOGOS[logoIndex]}
          alt="TWAM"
          className="brand-loader__logo"
          onError={() => {
            if (logoIndex < BRAND_LOGOS.length - 1) {
              setLogoIndex((index) => index + 1);
            } else {
              setLogoFailed(true);
            }
          }}
        />
      )}

      <div className="brand-loader__spinner" aria-hidden="true" />

      {showBranding && (
        <div className="brand-loader__typing">
          <span className="brand-loader__typing-text">{typedText}</span>
          <span className="brand-loader__typing-cursor" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
