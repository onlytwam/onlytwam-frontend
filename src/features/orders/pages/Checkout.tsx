// Checkout.tsx — redirects to the actual checkout flow
import { Navigate } from 'react-router-dom';

// The checkout flow starts at PaymentAddress.
// This stub redirect ensures anyone hitting /checkout lands correctly.
export default function Checkout() {
  return <Navigate to="/user-products/payment-address" replace />;
}
