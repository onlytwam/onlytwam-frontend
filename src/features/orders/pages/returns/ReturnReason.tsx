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
    border: `2px solid ${active ? '#111' : '#ccc'}`,
    background: active ? '#111' : '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  });

  return (
    <div className="container" style={{ padding: '32px 16px', maxWidth: 560 }}>
      <button onClick={() => navigate('/user-products/return-order')}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
        <i className="bi bi-arrow-left" /> Back
      </button>

      {/* Step indicator */}
      <div className="d-flex align-items-center gap-2 mb-4" style={{ fontSize: 12, color: '#888' }}>
        <span>Select Order</span><i className="bi bi-chevron-right" />
        <span className="fw-bold text-dark">Reason</span><i className="bi bi-chevron-right" />
        <span>Delivery</span><i className="bi bi-chevron-right" />
        <span>Refund</span><i className="bi bi-chevron-right" />
        <span>Confirm</span>
      </div>

      <h4 style={{ marginBottom: 6 }}>Reason for Return</h4>
      <p style={{ color: '#888', marginBottom: 24, fontSize: 14 }}>Please tell us why you want to return this item.</p>

      {REASONS.map(r => (
        <div key={r.id} onClick={() => setSelectedId(r.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            border: `2px solid ${selectedId === r.id ? '#111' : '#eee'}`,
            borderRadius: 8, padding: 14, marginBottom: 10, cursor: 'pointer',
            background: selectedId === r.id ? '#f9f9f9' : '#fff',
          }}>
          <div style={radioStyle(selectedId === r.id)}>
            {selectedId === r.id && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
          </div>
          <span style={{ fontSize: 14 }}>{r.name}</span>
        </div>
      ))}

      {selectedId === 7 && (
        <textarea className="form-control mt-2" rows={3} placeholder="Please describe your reason..."
          value={otherReason} onChange={e => setOtherReason(e.target.value)} />
      )}

      <button onClick={handleNext} disabled={!selectedId || (selectedId === 7 && !otherReason.trim())}
        style={{
          marginTop: 20, width: '100%', background: '#111', color: '#fff', border: 'none',
          padding: '12px', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: 14,
          opacity: (!selectedId || (selectedId === 7 && !otherReason.trim())) ? 0.5 : 1,
        }}>
        Continue — Choose Delivery Method <i className="bi bi-arrow-right ms-1" />
      </button>
    </div>
  );
}
