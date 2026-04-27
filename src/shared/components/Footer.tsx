import { useState } from "react";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/features/auth/store/authStore";
import { isValidEmail } from "@/shared/utils/helpers";
import toast from "react-hot-toast";
import api from "@/shared/api/axiosInstance";
export default function Footer() {
  const navigate = useNavigate();
  const { hasValidToken } = useAuthStore();
  const isMobile = useIsMobile();
  const currentYear = new Date().getFullYear();

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState(false);
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState(false);
  const [checking, setChecking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);
  const [isSubbed, setIsSubbed] = useState(false);
  const [showChannelPicker, setShowChannelPicker] = useState(false);

  const handleCheck = async () => {
    const hasEmail = !!email && isValidEmail(email);
    const hasPhone = !!phone && /^\d{10}$/.test(phone.trim());
    if (!hasEmail && !phone) { setEmailError(true); return; }
    if (email && !hasEmail) { setEmailError(true); return; }
    if (phone && !hasPhone) { setPhoneError(true); return; }
    setEmailError(false);
    setPhoneError(false);
    setChecking(true);
    try {
      if (hasEmail) {
        const res = await api.get("/Newsletter/Check", { params: { email } });
        setIsSubbed(res.data?.isSubscribed ?? false);
      }
      setChecked(true);
    } catch {
      toast.error("Could not check subscription status.");
    }
    setChecking(false);
  };

  const handleSubscribe = async (phoneChannel?: "whatsapp" | "sms") => {
    const hasPhone = !!phone && /^\d{10}$/.test(phone.trim());
    // If phone given and no channel chosen yet, show picker
    if (hasPhone && !phoneChannel) {
      setShowChannelPicker(true);
      return;
    }
    setShowChannelPicker(false);
    setLoading(true);
    try {
      await api.post("/Newsletter/Subscribe", {
        email: email || undefined,
        phone: hasPhone ? phone.trim() : undefined,
        channel: phoneChannel,
      });
      setIsSubbed(true);
      toast.success("Subscribed! Welcome to TWAM.");
    } catch {
      toast.error("Could not subscribe. Please try again.");
    }
    setLoading(false);
  };

  const handleUnsubscribe = async () => {
    setLoading(true);
    try {
      await api.post("/Newsletter/Unsubscribe", { email });
      setIsSubbed(false);
      toast.success("You have been unsubscribed.");
    } catch {
      toast.error("Could not unsubscribe. Please try again.");
    }
    setLoading(false);
  };

  const goTo = (path: string) => {
    navigate(path);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goToOrder = () => {
    if (hasValidToken()) goTo("/account/orders-list");
    else toast("Please login to access Orders");
  };

  if (isMobile) {
    return (
      <footer id="footer" className="footer-mobile">
        {/* Main footer body — warm ivory */}
        <div className="fmob-body">
          {/* Logo + tagline */}
          <div className="fmob-brand">
            <img
              src="/assets/Twam-Logo-Burgundy.png"
              alt="TWAM"
              className="fmob-logo"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  "/assets/Twam-Logo-Black.png";
              }}
            />
            <p className="fmob-tagline">Comfort for every woman.</p>
          </div>

          {/* Newsletter — compact single row */}
          <div className="fmob-newsletter">
            <p className="fmob-news-heading">Subscribe to our Newsletter</p>
            <div className="fmob-news-input-row">
              <input
                type="email"
                inputMode="email"
                autoComplete="off"
                placeholder="Email address"
                value={email}
                className={`fmob-news-input${emailError ? " error" : ""}`}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError(false);
                  setChecked(false);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleCheck()}
              />
              <button
                className="fmob-news-btn"
                onClick={handleCheck}
                disabled={checking}
              >
                {checking ? "..." : "→"}
              </button>
            </div>
            <div className="fmob-news-input-row" style={{ marginTop: 6 }}>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="off"
                placeholder="Phone (optional, for WhatsApp)"
                maxLength={10}
                value={phone}
                className={`fmob-news-input${phoneError ? " error" : ""}`}
                onChange={(e) => {
                  setPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
                  setPhoneError(false);
                  setChecked(false);
                }}
              />
            </div>
            {(emailError || phoneError) && (
              <p className="fmob-news-error">Enter a valid email or phone</p>
            )}
            {checked && !showChannelPicker && (
              <div className="fmob-news-actions">
                <button
                  className={`fmob-news-action${!isSubbed ? " primary" : ""}`}
                  onClick={() => handleSubscribe()}
                  disabled={isSubbed || loading}
                >
                  Subscribe
                </button>
                <button
                  className={`fmob-news-action${isSubbed ? " primary" : ""}`}
                  onClick={handleUnsubscribe}
                  disabled={!isSubbed || loading}
                >
                  Unsubscribe
                </button>
              </div>
            )}
            {showChannelPicker && (
              <div style={{ marginTop: 8 }}>
                <p style={{ fontSize: 12, color: "var(--heirloom)", marginBottom: 6 }}>
                  Receive updates on {phone} via:
                </p>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    className="fmob-news-action primary"
                    style={{ background: "#25D366", borderColor: "#25D366", display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}
                    onClick={() => handleSubscribe("whatsapp")}
                    disabled={loading}
                  >
                    <i className="bi bi-whatsapp" /> WhatsApp
                  </button>
                  <button
                    className="fmob-news-action primary"
                    style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}
                    onClick={() => handleSubscribe("sms")}
                    disabled={loading}
                  >
                    <i className="bi bi-chat-dots-fill" /> SMS
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Hairline */}
          <div className="fmob-rule" />

          {/* 2-col links: Support + TWAM */}
          <div className="fmob-links-grid">
            <div>
              <p className="fmob-col-title">Support</p>
              <button onClick={() => goTo("/size-guide")} className="fmob-link">
                Size Guide
              </button>
              <button onClick={goToOrder} className="fmob-link">
                Order Status
              </button>
              <button
                onClick={() => goTo("/returns-exchanges")}
                className="fmob-link"
              >
                Returns
              </button>
              <button
                onClick={() => goTo("/shipping-info")}
                className="fmob-link"
              >
                Shipping Info
              </button>
              <button
                onClick={() => goTo("/return-refund-policy")}
                className="fmob-link"
              >
                Refund Policy
              </button>
            </div>
            <div>
              <p className="fmob-col-title">TWAM</p>
              <button onClick={() => goTo("/about")} className="fmob-link">
                Our Story
              </button>
              <button onClick={() => goTo("/our-blog")} className="fmob-link">
                Blog
              </button>
              <button
                onClick={() => goTo("/twam-brands")}
                className="fmob-link"
              >
                TWAM Brands
              </button>
              <button
                onClick={() => goTo("/privacy-policy")}
                className="fmob-link"
              >
                Privacy Policy
              </button>
              <button
                onClick={() => goTo("/terms-conditions")}
                className="fmob-link"
              >
                Terms
              </button>
            </div>
          </div>

          {/* Hairline */}
          <div className="fmob-rule" />

          {/* Address compact */}
          <div className="fmob-address">
            <i className="bi bi-geo-alt fmob-addr-icon" />
            <span>
              GSM Mall, Miyapur, Hyderabad 500050 ·{" "}
              <a href="tel:+917036534449" className="fmob-addr-link">
                +91 70365 34449
              </a>{" "}
              ·{" "}
              <a
                href="mailto:customersupport@onlytwam.com"
                className="fmob-addr-link"
              >
                customersupport@onlytwam.com
              </a>
            </span>
          </div>

          {/* Hairline */}
          <div className="fmob-rule" />

          {/* Socials + copyright */}
          <div className="fmob-bottom">
            <div className="fmob-socials">
              {[
                {
                  href: "https://www.facebook.com/onlyTwam/",
                  icon: "facebook.svg",
                  label: "Facebook",
                },
                {
                  href: "https://www.instagram.com/onlytwam/",
                  icon: "instagram.svg",
                  label: "Instagram",
                },
                {
                  href: "https://wa.link/y2zqo7",
                  icon: "whatsapp.svg",
                  label: "WhatsApp",
                },
                {
                  href: "https://www.youtube.com/channel/UCHeGOyt3gARVUcWuYTvUdgg",
                  icon: "youtube.svg",
                  label: "YouTube",
                },
              ].map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="fmob-social-link"
                >
                  <img
                    src={`/assets/social/${s.icon}`}
                    alt={s.label}
                    className="fmob-social-icon"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </a>
              ))}
            </div>
            <p className="fmob-copy">© {currentYear} TWAM</p>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer id="footer" className="footer">
      <div className="container footer-container">
        {/* Newsletter Section */}
        <div className="subscribe-section">
          <div className="subscribe-inner">
            <div className="subscribe-text-col">
              <h2 className="subscribe-title">Subscribe to Our Newsletter</h2>
              <h4 className="subscribe-subtitle">
                Be the first to know about new arrivals, limited-time offers,
                comfort tips, and more.
              </h4>
            </div>

            <div className="subscribe-form-col">
              <p className="subscribe-label">Stay up to date</p>

              <div className="subscribe-input-group">
                <input
                  type="text"
                  inputMode="email"
                  autoComplete="off"
                  name="newsletter_email"
                  placeholder="Email address"
                  value={email}
                  className={`subscribe-input ${emailError ? "error" : ""}`}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError(false);
                    setChecked(false);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleCheck()}
                />
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="off"
                  name="newsletter_phone"
                  placeholder="Phone (optional)"
                  maxLength={10}
                  value={phone}
                  className={`subscribe-input ${phoneError ? "error" : ""}`}
                  style={{ marginLeft: 8, maxWidth: 140 }}
                  onChange={(e) => {
                    setPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
                    setPhoneError(false);
                    setChecked(false);
                  }}
                />
                <button
                  className="subscribe-submit-btn"
                  onClick={handleCheck}
                  disabled={checking}
                >
                  {checking ? <span className="subscribe-spinner" /> : "→"}
                </button>
              </div>

              <p className={`subscribe-error-msg ${emailError ? "visible" : ""}`}>
                * Please enter a valid email or phone number
              </p>
              <p className={`subscribe-error-msg ${phoneError ? "visible" : ""}`}>
                * Please enter a valid 10-digit phone number
              </p>

              {checked && !showChannelPicker && (
                <div className="subscribe-action-btns">
                  <button
                    className={`sub-action-btn ${!isSubbed ? "active" : "disabled"}`}
                    onClick={() => handleSubscribe()}
                    disabled={isSubbed || loading}
                    title={isSubbed ? "Already subscribed" : "Subscribe"}
                  >
                    {isSubbed && <i className="bi bi-slash-circle" />} Subscribe
                  </button>

                  <button
                    className={`sub-action-btn ${isSubbed ? "active" : "disabled"}`}
                    onClick={handleUnsubscribe}
                    disabled={!isSubbed || loading}
                    title={!isSubbed ? "Not subscribed" : "Unsubscribe"}
                  >
                    {!isSubbed && <i className="bi bi-slash-circle" />}{" "}
                    Unsubscribe
                  </button>
                </div>
              )}

              {showChannelPicker && (
                <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <p style={{ width: "100%", fontSize: 13, color: "var(--heirloom)", margin: "0 0 6px" }}>
                    Receive WhatsApp updates on <strong>{phone}</strong>:
                  </p>
                  <button
                    className="sub-action-btn active"
                    style={{ background: "#25D366", borderColor: "#25D366", display: "flex", alignItems: "center", gap: 6 }}
                    onClick={() => handleSubscribe("whatsapp")}
                    disabled={loading}
                  >
                    <i className="bi bi-whatsapp" /> WhatsApp
                  </button>
                  <button
                    className="sub-action-btn active"
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                    onClick={() => handleSubscribe("sms")}
                    disabled={loading}
                  >
                    <i className="bi bi-chat-dots-fill" /> SMS only
                  </button>
                  <button
                    className="sub-action-btn disabled"
                    style={{ fontSize: 12 }}
                    onClick={() => { setPhone(""); handleSubscribe(undefined); }}
                    disabled={loading}
                  >
                    Skip phone
                  </button>
                </div>
              )}

              <p className="subscribe-policy">
                By subscribing you agree to our{" "}
                <Link to="/news-privacy-policy">Privacy policy</Link>
              </p>
            </div>
          </div>
        </div>

        {/* Footer Links Area */}
        <div className="footer-main">
          <div className="footer-brand-col">
            <Link
              to="/"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            >
              <img
                src="/assets/Twam-Logo-Black.png"
                alt="TWAM"
                className="footer-logo"
              />
            </Link>
            <p className="footer-desc">
              We are Only TWAM, a multibrand platform where women have a wide
              variety of lingerie brands, that can help them pick their most
              comfortable fit based on their daily needs.
            </p>
          </div>

          <div className="footer-links-col">
            <h4 className="footer-col-title">Support</h4>
            <ul className="footer-links-list">
              <li>
                <button
                  onClick={() => goTo("/size-guide")}
                  className="footer-link-btn"
                >
                  Size Guide
                </button>
              </li>
              <li>
                <button onClick={goToOrder} className="footer-link-btn">
                  Order Status
                </button>
              </li>
              <li>
                <button
                  onClick={() => goTo("/returns-exchanges")}
                  className="footer-link-btn"
                >
                  Returns &amp; Exchanges
                </button>
              </li>
              <li>
                <button
                  onClick={() => goTo("/shipping-info")}
                  className="footer-link-btn"
                >
                  Shipping Info
                </button>
              </li>
              <li>
                <button
                  onClick={() => goTo("/help-center")}
                  className="footer-link-btn"
                >
                  Help Center
                </button>
              </li>
              <li>
                <button
                  onClick={() => goTo("/delivery-shipping-policy")}
                  className="footer-link-btn"
                >
                  Delivery &amp; Shipping Policy
                </button>
              </li>
              <li>
                <button
                  onClick={() => goTo("/return-refund-policy")}
                  className="footer-link-btn"
                >
                  Refund Policy
                </button>
              </li>
            </ul>
          </div>

          <div className="footer-links-col twam-links-col">
            <h4 className="footer-col-title">TWAM</h4>
            <ul className="footer-links-list">
              <li>
                <button
                  onClick={() => goTo("/about")}
                  className="footer-link-btn"
                >
                  Our Story
                </button>
              </li>
              <li>
                <button
                  onClick={() => goTo("/our-blog")}
                  className="footer-link-btn"
                >
                  Blog
                </button>
              </li>
              <li>
                <button
                  onClick={() => goTo("/twam-brands")}
                  className="footer-link-btn"
                >
                  TWAM Brands
                </button>
              </li>
            </ul>
          </div>

          <div className="footer-contact-col">
            <h4 className="footer-col-title">Contact Information</h4>
            <div className="footer-contact-list">
              <div className="footer-contact-item">
                <i className="bi bi-geo-alt footer-contact-icon" />
                <span>
                  GSM Mall, Miyapur Main Rd, ICRISAT Colony, Madeenaguda,
                  Hyderabad, Telangana 500050
                </span>
              </div>
              <div className="footer-contact-item">
                <i className="bi bi-telephone footer-contact-icon" />
                <span>+91 7036534449</span>
              </div>
              <div className="footer-contact-item">
                <i className="bi bi-envelope footer-contact-icon" />
                <a
                  href="mailto:customersupport@onlytwam.com"
                  className="footer-contact-link"
                >
                  customersupport@onlytwam.com
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Bottom Bar */}
      <div className="footer-bottom">
        <div className="container footer-bottom-inner">
          <div className="footer-bottom-left">
            <p className="footer-copy">
              © {currentYear} <strong>TWAM</strong>. All Rights Reserved.
            </p>
            <div className="footer-policy-links">
              <button
                onClick={() => goTo("/terms-conditions")}
                className="footer-link-btn"
              >
                Terms &amp; Conditions
              </button>
              <button
                onClick={() => goTo("/privacy-policy")}
                className="footer-link-btn"
              >
                Privacy Policy
              </button>
            </div>
          </div>

          <div className="footer-socials">
            {[
              {
                href: "https://www.facebook.com/onlyTwam/",
                icon: "facebook.svg",
                label: "Facebook",
              },
              {
                href: "https://www.instagram.com/onlytwam/",
                icon: "instagram.svg",
                label: "Instagram",
              },
              { href: "#", icon: "twitter.svg", label: "Twitter" },
              {
                href: "https://wa.link/y2zqo7",
                icon: "whatsapp.svg",
                label: "WhatsApp",
              },
              {
                href: "https://www.youtube.com/channel/UCHeGOyt3gARVUcWuYTvUdgg",
                icon: "youtube.svg",
                label: "YouTube",
              },
            ].map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
              >
                <img
                  src={`/assets/social/${s.icon}`}
                  alt={s.label}
                  className="footer-social-icon"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}