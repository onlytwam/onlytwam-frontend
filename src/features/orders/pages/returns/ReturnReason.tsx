// Fixed: flow should be return-order → return-reason → delivery-option → refund-choice → return-confirm
// Was navigating to refund-choice directly, skipping delivery-option

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const REASONS = [
  { id: 1, name: 'I want to return a sealed product' },
  { id: 2, name: 'I want to return a mistaken order' },
  { id: 3, name: 'Defective or Damaged Product' },
  { id: 4, name: 'Incorrect Product Received' },
  { id: 5, name: 'Unsatisfactory Quality' },
  { id: 6, name: 'Size / Fit Issue' },
  { id: 7, name: 'Other' },
];

export default function ReturnReason() {
  const navigate      = useNavigate();
  const [selectedId,  setSelectedId]  = useState<number | null>(null);
  const [otherReason, setOtherReason] = useState('');

  const handleNext = () => {
    if (!selectedId) return;
    const existing = JSON.parse(sessionStorage.getItem('returnOrder') || '{}');
    sessionStorage.setItem('returnOrder', JSON.stringify({
      ...existing,
      reasonId:    selectedId,
      otherReason: selectedId === 7 ? otherReason : '',
    }));
    // FIX: go to delivery-option, not refund-choice (that was skipping a step)
    navigate('/user-products/delivery-option');
  };

  const radioStyle = (active: boolean) => ({
    width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
    border: `2px solid ${active ? '#000000' : 'var(--ivory)'}`,
    background: active ? '#000000' : '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  });

  return (
    <div className="container s-returnreason-2a3313">
      <button onClick={() => navigate('/user-products/return-order')}
        className="s-deliveryopti-01d82d">
        <i className="bi bi-arrow-left" /> Back
      </button>

      {/* Step indicator */}
      <div className="d-flex align-items-center gap-2 mb-4 s-adminnewslet-f01220">
        <span>Select Order</span><i className="bi bi-chevron-right" />
        <span className="fw-bold text-dark">Reason</span><i className="bi bi-chevron-right" />
        <span>Delivery</span><i className="bi bi-chevron-right" />
        <span>Refund</span><i className="bi bi-chevron-right" />
        <span>Confirm</span>
      </div>

      <h4 className="s-deliveryopti-186182">Reason for Return</h4>
      <p className="s-deliveryopti-78aac5">Please tell us why you want to return this item.</p>

      {REASONS.map(r => (
        <div key={r.id} onClick={() => setSelectedId(r.id)}
          className="s-returnreason-927a48" style={ {border: `2px solid ${selectedId === r.id ? '#000000' : 'var(--ivory)'}`, background: selectedId === r.id ? 'var(--ivory)' : '#fff'} }>
          <div style={radioStyle(selectedId === r.id)}>
            {selectedId === r.id && <div className="s-payment-108f10" />}
          </div>
          <span className="s-addresslist-92985e">{r.name}</span>
        </div>
      ))}

      {selectedId === 7 && (
        <textarea className="form-control mt-2" rows={3} placeholder="Please describe your reason..."
          value={otherReason} onChange={e => setOtherReason(e.target.value)} />
      )}

      <button onClick={handleNext} disabled={!selectedId || (selectedId === 7 && !otherReason.trim())}
        className="s-returnreason-1083c1" style={{ opacity: (!selectedId || (selectedId === 7 && !otherReason.trim())) ? 0.5 : 1 }}>
        Continue — Choose Delivery Method <i className="bi bi-arrow-right ms-1" />
      </button>
    </div>
  );
}
