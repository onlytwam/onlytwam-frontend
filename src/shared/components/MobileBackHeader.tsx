import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

type MobileBackHeaderProps = {
  title?: ReactNode;
  onBack?: () => void;
  className?: string;
};

export default function MobileBackHeader({
  title,
  onBack,
  className = "",
}: MobileBackHeaderProps) {
  const navigate = useNavigate();

  const handleBack = onBack ?? (() => navigate(-1));

  return (
    <>
      <div
        className={`checkout-mobile-header${className ? ` ${className}` : ""}`}
      >
        <button
          type="button"
          className="checkout-mobile-back"
          onClick={handleBack}
          aria-label="Go back"
        >
          <i className="bi bi-chevron-left" />
        </button>
        {title ? <h1 className="cart-page-mobile-title">{title}</h1> : null}
      </div>
      <div className="checkout-mobile-header-spacer" aria-hidden="true" />
    </>
  );
}
