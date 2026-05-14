import type { ReactNode } from "react";

type Props = {
  backgroundImage: string;
  children: ReactNode;
};

export default function AuthBackdrop({ backgroundImage, children }: Props) {
  return (
    <div
      style={{
        minHeight: "100vh",
        position: "relative",
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
        padding: "clamp(16px, 3vw, 48px)",
        backgroundImage: `url("${backgroundImage}")`,
        backgroundPosition: "center",
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
        overflow: "hidden",
      }}
      >
      <style>{`
        .auth-glass-card {
          color: #111 !important;
          background: rgba(255, 255, 255, 0.62) !important;
          border: 1px solid rgba(255, 255, 255, 0.78) !important;
          box-shadow: 0 16px 48px rgba(0, 0, 0, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.72) !important;
          backdrop-filter: blur(24px) saturate(175%) !important;
          -webkit-backdrop-filter: blur(24px) saturate(175%) !important;
        }
        .auth-glass-card :is(h1, h2, h3, h4, h5, h6, p, label, span, a, small, div, i) {
          color: #111 !important;
        }
        .auth-glass-card .s-login-c6af62,
        .auth-glass-card .s-login-8c5379,
        .auth-glass-card .s-resetpasswor-33ec0d {
          color: #fff !important;
        }
        .auth-glass-card .s-login-3b11d9 {
          background: rgba(255, 255, 255, 0.55) !important;
          border-color: rgba(0, 0, 0, 0.08) !important;
        }
        .auth-glass-card .auth-err-text,
        .auth-glass-card .invalid-feedback {
          color: #111 !important;
        }
      `}</style>
      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: 520,
          marginLeft: "auto",
        }}
      >
        <div
          className="auth-glass-card"
          style={{
            background: "rgba(255,255,255,0.62)",
            border: "1px solid rgba(255,255,255,0.78)",
            borderRadius: 28,
            boxShadow:
              "0 16px 48px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.72)",
            backdropFilter: "blur(24px) saturate(175%)",
            WebkitBackdropFilter: "blur(24px) saturate(175%)",
            padding: "clamp(18px, 2.4vw, 28px)",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
