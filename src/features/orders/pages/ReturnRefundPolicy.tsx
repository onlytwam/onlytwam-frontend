import { Link } from 'react-router-dom';
export default function ReturnRefundPolicy() {
  return (
    <div>
      <div className="s-returnrefund-e9f050">
        <h1 className="s-deliveryship-13f5e5">Return & Refund Policy</h1>
        <p className="s-adminorders-18f7bb s-returnrefund-412217">Easy returns within 15 days of delivery.</p>
      </div>
      <div className="container s-deliveryship-6da314">
        <h3 className="s-deliveryship-a4dc9e">Return Eligibility</h3>
        <ul className="s-deliveryship-35e44d">
          <li>Items must be returned within <strong>15 days</strong> of delivery.</li>
          <li>Products must be unworn, unwashed, with original tags and packaging.</li>
          <li>Innerwear and swimwear: exchange only (not eligible for full return).</li>
          <li>"Final Sale" or heavily discounted items are non-returnable.</li>
        </ul>
        <h3 className="s-deliveryship-562796">Refund Process</h3>
        <ul className="s-deliveryship-35e44d">
          <li>Once your return is received and inspected, we will process your refund within 5–7 business days.</li>
          <li>Refunds are credited to the original payment method.</li>
          <li>Shipping charges are non-refundable unless the return is due to a defect or wrong item.</li>
        </ul>
        <h3 className="s-deliveryship-562796">How to Initiate a Return</h3>
        <ol className="s-deliveryship-35e44d">
          <li>Log in to your account and go to <strong>My Orders</strong>.</li>
          <li>Select the order and click <strong>Return / Exchange</strong>.</li>
          <li>Choose your reason and preferred resolution.</li>
          <li>Schedule a pickup or drop off at a courier partner.</li>
        </ol>
        <p className="s-deliveryship-6c04e1"><Link to="/contact-us" className="s-register-51a817">Contact support</Link> for any return queries.</p>
      </div>
    </div>
  );
}