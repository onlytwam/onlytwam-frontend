import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/features/auth/store/authStore";
import { accountNavItems } from "@/features/account/accountNav";
import UserAvatar from "@/shared/components/UserAvatar";
import { useIsMobile } from "@/shared/hooks/useIsMobile";

function AccountShortcutRow({
  icon,
  label,
  onClick,
  tone = "default",
}: {
  icon: string;
  label: string;
  onClick: () => void;
  tone?: "default" | "muted" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="s-userdashboar-mobile-shortcut"
      data-tone={tone}
    >
      <span className="s-userdashboar-mobile-shortcut__lead">
        <span className="s-userdashboar-mobile-shortcut__icon">
          <i className={`bi ${icon}`} />
        </span>
        <span className="s-userdashboar-mobile-shortcut__label">{label}</span>
      </span>
      <i className="bi bi-chevron-right s-userdashboar-mobile-shortcut__chev" />
    </button>
  );
}

function TypingPill({ text }: { text: string }) {
  const [displayText, setDisplayText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    if (!isDeleting && displayText.length < text.length) {
      timer = setTimeout(() => {
        setDisplayText(text.slice(0, displayText.length + 1));
      }, 110);
    } else if (!isDeleting && displayText.length === text.length) {
      timer = setTimeout(() => {
        setIsDeleting(true);
      }, 2200);
    } else if (isDeleting && displayText.length > 0) {
      timer = setTimeout(() => {
        setDisplayText(text.slice(0, displayText.length - 1));
      }, 55);
    } else if (isDeleting && displayText.length === 0) {
      timer = setTimeout(() => {
        setIsDeleting(false);
      }, 160);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [displayText, isDeleting, text]);

  return (
    <span className="s-profilelayou-typing s-accounthome-mobile__typing">
      <span className="s-profilelayou-typing-text">{displayText}</span>
      <span className="s-profilelayou-typing-cursor" aria-hidden="true" />
    </span>
  );
}

export default function AccountHome() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user, getUserName, logout } = useAuthStore();
  const userName = getUserName();
  const profileImageUrl = (user as any)?.profileImageUrl || "";

  const handleSignOut = () => {
    logout();
    navigate("/");
  };

  const handleSupport = () => {
    navigate("/contact-us");
  };

  if (!isMobile) {
    return <Navigate to="/account/dashboard" replace />;
  }

  return (
    <div className="s-accounthome-mobile s-userdashboar-mobile-page">
      <section className="s-userdashboar-mobile-hero">
        <div className="s-userdashboar-mobile-hero__glow" />
        <div className="s-userdashboar-mobile-hero__row">
          <UserAvatar
            name={userName || "User"}
            imageUrl={profileImageUrl}
            size={56}
            fallbackMode="initial"
            className="s-userdashboar-mobile-hero__avatar"
            style={{
              boxShadow: "none",
              background: "var(--ivory)",
              border: "1px solid rgba(107, 15, 42, 0.1)",
              color: "var(--brand)",
            }}
          />
          <div className="s-userdashboar-mobile-hero__copy">
            <p className="s-userdashboar-mobile-hero__eyebrow">Welcome back</p>
            <h2 className="s-userdashboar-mobile-hero__title twam-font-heading twam-brand">
              {userName || "Guest"}
            </h2>
            <div className="s-accounthome-mobile__typing-wrap">
              <TypingPill text="Hey Beautiful" />
            </div>
          </div>
        </div>
      </section>

      <section
        className="s-userdashboar-mobile-shortcuts"
        aria-label="Account sections"
      >
        {accountNavItems.map((item) => (
          <AccountShortcutRow
            key={item.path}
            icon={item.icon}
            label={item.label}
            onClick={() => navigate(item.path)}
          />
        ))}
        <div
          className="s-userdashboar-mobile-shortcuts__divider"
          aria-hidden="true"
        />
        <AccountShortcutRow
          icon="bi-headset"
          label="Customer Support"
          onClick={handleSupport}
          tone="muted"
        />
        <AccountShortcutRow
          icon="bi-box-arrow-right"
          label="Sign Out"
          onClick={handleSignOut}
          tone="danger"
        />
      </section>
    </div>
  );
}
