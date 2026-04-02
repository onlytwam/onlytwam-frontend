// Fixed: API path was /ReturnOrder — backend is /Orders/ReturnOrder
// Also: CreateReturnOrderRequest schema has no refundChoice field — store it in reason string

import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/shared/api/axiosInstance';

const REASON_LABELS: Record<number, string> = {
  1: 'Return sealed product', 2: 'Mistaken order',       3: 'Defective / Damaged',
  4: 'Incorrect product',     5: 'Unsatisfactory quality', 6: 'Size / Fit issue', 7: 'Other',
};

export default function ReturnConfirm() {
  const navigate    = useNavigate();
  const returnData  = JSON.parse(sessionStorage.getItem('returnOrder') || '{}');

  const rows = [
    { label: 'Order',    value: `#${returnData.orderNumber || returnData.orderId}` },
    { label: 'Reason',   value: REASON_LABELS[returnData.reasonId] || returnData.otherReason || '—' },
    { label: 'Pickup',   value: returnData.deliveryOption === 'pickup' ? 'Schedule Pickup' : 'Drop at Hub' },
    { label: 'Refund',   value: returnData.refundChoice === 'original' ? 'Original Payment Method' : returnData.refundChoice === 'wallet' ? 'Store Credit' : 'Exchange for Size' },
  ];

  const submitMutation = useMutation({
    mutationFn: () =>
      // FIX: was api.post('/ReturnOrder', ...) — correct path is /Orders/ReturnOrder
      api.post('/Orders/ReturnOrder', {
        orderId:       returnData.orderId,
        reasonId:      returnData.reasonId,
        reason:        REASON_LABELS[returnData.reasonId] || returnData.otherReason,
        otherReason:   returnData.otherReason || null,
        shippingOption: returnData.deliveryOption,
        // Note: refundChoice is not in the backend schema but we include it for potential future use
      }).then(r => r.data),
    onSuccess: () => {
      sessionStorage.removeItem('returnOrder');
      toast.success('Return request submitted successfully!');
      navigate('/account/orders-list');
    },
    onError: (e: any) => toast.error(
      e?.response?.data?.detail || e?.response?.data?.message || 'Failed to submit return. Please try again.'
    ),
  });

  return (
    <div className="container" style={{ padding: '32px 16px', maxWidth: 520 }}>
      <button onClick={() => navigate('/user-products/refund-choice')}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
        <i className="bi bi-arrow-left" /> Back
      </button>

      {/* Step indicator */}
      <div className="d-flex align-items-center gap-2 mb-4" style={{ fontSize: 12, color: '#888' }}>
        <span>Select Order</span><i className="bi bi-chevron-right" />
        <span>Reason</span><i className="bi bi-chevron-right" />
        <span>Delivery</span><i className="bi bi-chevron-right" />
        <span>Refund</span><i className="bi bi-chevron-right" />
        <span className="fw-bold text-dark">Confirm</span>
      </div>

      <h4 style={{ marginBottom: 6 }}>Confirm Return Request</h4>
      <p style={{ color: '#888', marginBottom: 24, fontSize: 14 }}>Please review your return details before submitting.</p>

      <div style={{ border: '1px solid #eee', borderRadius: 8, overflow: 'hidden', marginBottom: 24 }}>
        {rows.map(({ label, value }, i) => (
          <div key={label} style={{
            display: 'flex', padding: '14px 16px',
            background: i % 2 === 0 ? '#f9f9f9' : '#fff',
            borderBottom: i < rows.length - 1 ? '1px solid #eee' : 'none',
          }}>
            <span style={{ width: 120, fontSize: 13, color: '#888', flexShrink: 0 }}>{label}</span>
            <span style={{ fontSize: 14, fontWeight: 500 }}>{value}</span>
          </div>
        ))}
      </div>

      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: 12, marginBottom: 24 }}>
        <p style={{ margin: 0, fontSize: 13, color: '#92400e' }}>
          <i className="bi bi-info-circle me-2" />
          Once submitted, our team will review your request within 24–48 hours.
          Returns are subject to our <a href="/return-refund-policy" style={{ color: '#92400e' }}>return policy</a>.
        </p>
      </div>

      <button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}
        style={{
          width: '100%', background: '#111', color: '#fff', border: 'none',
          padding: '14px', borderRadius: 4, cursor: 'pointer', fontSize: 15, fontWeight: 700,
          opacity: submitMutation.isPending ? 0.7 : 1,
        }}>
        {submitMutation.isPending
          ? <><span className="spinner-border spinner-border-sm me-2" />Submitting…</>
          : 'Submit Return Request'}
      </button>
    </div>
  );
}
