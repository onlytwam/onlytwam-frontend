import { Link } from 'react-router-dom';
export default function DeliveryShippingPolicy() {
  return (
    <div>
      <div className="s-deliveryship-947f34">
        <h1 className="s-deliveryship-13f5e5">Delivery & Shipping Policy</h1>
        <p className="s-adminorders-18f7bb s-deliveryship-c79f5e">Our policy for deliveries and shipments.</p>
      </div>
      <div className="container s-deliveryship-6da314">
        <h3 className="s-deliveryship-a4dc9e">Free Shipping</h3>
        <ul className="s-deliveryship-35e44d"><li>Delivered within 7–10 business days.</li><li>Shipping Cost: ₹0 (for orders over ₹5000).</li></ul>
        <h3 className="s-deliveryship-562796">Standard Delivery</h3>
        <ul className="s-deliveryship-35e44d"><li>Delivered within 5–7 business days.</li><li>Shipping Cost: ₹99 for orders below ₹5000.</li></ul>
        <h3 className="s-deliveryship-562796">Express Delivery</h3>
        <ul className="s-deliveryship-35e44d"><li>Delivered within 2–3 business days (select cities).</li><li>Shipping Cost: ₹199.</li></ul>
        <h3 className="s-deliveryship-562796">Important Notes</h3>
        <ul className="s-deliveryship-35e44d">
          <li>Delivery timelines are estimates and may vary during peak season, public holidays, or unforeseen circumstances.</li>
          <li>Orders placed after 12 PM are processed the next business day.</li>
          <li>We do not ship internationally at this time.</li>
          <li>Once shipped, you will receive a tracking link via SMS and email.</li>
        </ul>
        <p className="s-deliveryship-6c04e1">Questions? <Link to="/contact-us" className="s-register-51a817">Contact Us</Link> or email <a href="mailto:customersupport@onlytwam.com" className="s-resetpasswor-ddc1b2">customersupport@onlytwam.com</a></p>
      </div>
    </div>
  );
}