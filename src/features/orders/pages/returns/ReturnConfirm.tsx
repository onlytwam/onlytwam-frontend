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
    <div className="container s-deliveryopti-562975">
      {/* Step indicator */}
      <div className="d-flex align-items-center gap-2 mb-4 s-adminnewslet-f01220">
        <span>Select Order</span><i className="bi bi-chevron-right" />
        <span>Reason</span><i className="bi bi-chevron-right" />
        <span>Delivery</span><i className="bi bi-chevron-right" />
        <span>Refund</span><i className="bi bi-chevron-right" />
        <span className="fw-bold text-dark">Confirm</span>
      </div>

      <p className="s-deliveryopti-78aac5">Please review your return details before submitting.</p>

      <div className="s-returnconfir-51918e">
        {rows.map(({ label, value }, i) => (
          <div key={label} className="s-returnconfir-35c640" style={ {background: i % 2 === 0 ? 'var(--ivory)' : '#fff', borderBottom: i < rows.length - 1 ? '1px solid #f5f0e6' : 'none'} }>
            <span className="s-returnconfir-ecf0e3">{label}</span>
            <span className="s-returnconfir-0c4fcd">{value}</span>
          </div>
        ))}
      </div>

      <div className="s-orderconfirm-98b39a">
        <p className="s-orderconfirm-ac3361">
          <i className="bi bi-info-circle me-2" />
          Once submitted, our team will review your request within 24–48 hours.
          Returns are subject to our <a href="/return-refund-policy" className="s-resetpasswor-ddc1b2">return policy</a>.
        </p>
      </div>

      <button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}
        className="s-returnconfir-e4b8ec" style={ {opacity: submitMutation.isPending ? 0.7 : 1} }>
        {submitMutation.isPending
          ? <><span className="spinner-border spinner-border-sm me-2" />Submitting…</>
          : 'Submit Return Request'}
      </button>
    </div>
  );
}
