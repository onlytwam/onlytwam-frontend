import { Link } from "react-router-dom";

const policyHighlights = [
  {
    title: "Clear timelines",
    text: "Refunds for eligible cancellations are usually processed within 7-10 business days after approval.",
  },
  {
    title: "Cancellation only",
    text: "This policy applies only when an order is cancelled before dispatch.",
  },
  {
    title: "Quick support",
    text: "If you need help with a cancellation, our support team can guide you.",
  },
];

export default function ReturnRefundPolicy() {
  return (
    <main className="refund-policy-page">
      <section className="refund-policy-hero">
        <div className="container refund-policy-hero-inner">
          <p className="refund-policy-kicker">Return & Refund Policy</p>
          <h1 className="refund-policy-title">
            Clear, simple guidance for cancellations, returns, and refunds.
          </h1>
          <p className="refund-policy-subtitle">
            TWAM does not accept returns or exchanges. Refunds are available
            only when an order is cancelled before it is shipped.
          </p>

          <div className="refund-policy-highlights">
            {policyHighlights.map((item) => (
              <article key={item.title} className="refund-policy-highlight-card">
                <h2>{item.title}</h2>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <div className="container refund-policy-content">
        <section className="refund-policy-section">
          <h2>About this policy</h2>
          <p>
            Tulasi Twam Private Limited ("TWAM", "we", "us", or "our") operates
            the website www.onlytwam.com. This policy explains how pre-dispatch
            cancellations are handled and when a refund may be issued. It should
            be read together with our Terms & Conditions.
          </p>
        </section>

        <section className="refund-policy-section">
          <h2>Cancellation of orders</h2>
          <ul>
            <li>You may cancel an order before it is shipped by reaching out through our Customer Support page.</li>
            <li>Once an order has been dispatched, cancellation is no longer possible.</li>
            <li>If a prepaid order is cancelled before shipment, the amount is returned to the original payment method within 7-10 business days after approval.</li>
            <li>Cash on Delivery orders are not eligible for refund if the order was not prepaid.</li>
          </ul>
        </section>

        <section className="refund-policy-section">
          <h2>Returns and exchanges</h2>
          <p>
            TWAM does not accept returns or exchanges for delivered items.
            Because our products are intimatewear and personal-use items, this
            policy helps us maintain hygiene, safety, and product integrity for
            every customer.
          </p>
          <ul>
            <li>No return requests are accepted after delivery.</li>
            <li>No exchange requests are offered for size, fit, or preference changes.</li>
            <li>If your order has not yet been shipped, you may cancel it and request a refund instead.</li>
            <li>If the item was damaged, missing, or incorrect, contact Customer Support promptly for assistance.</li>
          </ul>
        </section>

        <section className="refund-policy-section">
          <h2>Refunds</h2>
          <p>
            Refunds are available only for orders that are cancelled before
            shipment and approved by our team.
          </p>

          <div className="refund-policy-metrics">
            <article>
              <span>Timeline</span>
              <strong>7-10 business days</strong>
              <p>After approval of the request.</p>
            </article>
            <article>
              <span>Method</span>
              <strong>Original payment method</strong>
              <p>Card, UPI, or net banking.</p>
            </article>
            <article>
              <span>Eligibility</span>
              <strong>Before dispatch only</strong>
              <p>After shipment, cancellation is no longer possible.</p>
            </article>
          </div>

          <ul>
            <li>Shipping charges, if any, are non-refundable.</li>
            <li>We do not offer cash refunds.</li>
          </ul>
        </section>

        <section className="refund-policy-section">
          <h2>Need help?</h2>
          <p>
            If you need support with a cancellation or refund request,
            please contact our Customer Support team.
          </p>
          <div className="refund-policy-support">
            <span>Contact</span>
            <Link to="/contact-us">Customer Support</Link>
          </div>
        </section>

        <section className="refund-policy-section refund-policy-footer-card">
          <p>
            TWAM may update this policy from time to time. Changes will be
            posted here, and continued use of the site means you accept the
            updated version.
          </p>
        </section>
      </div>
    </main>
  );
}
