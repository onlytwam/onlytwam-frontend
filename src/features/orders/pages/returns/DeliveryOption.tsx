import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const DELIVERY_OPTIONS = [
  { id: 'pickup', label: 'Schedule a Pickup', icon: 'bi-truck', desc: 'We will pick up the item from your address' },
  { id: 'dropoff', label: 'Drop at Nearest Hub', icon: 'bi-building', desc: 'Drop your package at the nearest courier hub' },
];

export default function DeliveryOption() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState('');

  const handleNext = () => {
    if (!selected) return;
    const returnData = JSON.parse(sessionStorage.getItem('returnOrder') || '{}');
    sessionStorage.setItem('returnOrder', JSON.stringify({ ...returnData, deliveryOption: selected }));
    navigate('/user-products/refund-choice');
  };

  return (
    <div className="container" style={{ padding: '32px 16px', maxWidth: 520 }}>
      <button onClick={() => navigate('/user-products/return-reason')}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
        <i className="bi bi-arrow-left" /> Back
      </button>
      <h4 style={{ marginBottom: 6 }}>Delivery Option</h4>
      <p style={{ color: '#888', marginBottom: 24, fontSize: 14 }}>How would you like to send back the item?</p>

      {DELIVERY_OPTIONS.map(opt => (
        <div key={opt.id} onClick={() => setSelected(opt.id)}
          style={{ display: 'flex', alignItems: 'center', gap: 16, border: `2px solid ${selected === opt.id ? '#111' : '#eee'}`, borderRadius: 8, padding: 16, marginBottom: 12, cursor: 'pointer', background: selected === opt.id ? '#f9f9f9' : '#fff' }}>
          <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${selected === opt.id ? '#111' : '#ccc'}`, background: selected === opt.id ? '#111' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {selected === opt.id && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
          </div>
          <i className={`bi ${opt.icon}`} style={{ fontSize: 24, color: '#555' }} />
          <div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{opt.label}</p>
            <p style={{ margin: 0, fontSize: 13, color: '#888' }}>{opt.desc}</p>
          </div>
        </div>
      ))}

      <button onClick={handleNext} disabled={!selected}
        style={{ marginTop: 16, width: '100%', background: '#111', color: '#fff', border: 'none', padding: '12px', borderRadius: 4, cursor: selected ? 'pointer' : 'not-allowed', opacity: selected ? 1 : 0.5, fontWeight: 600 }}>
        Continue <i className="bi bi-arrow-right ms-1" />
      </button>
    </div>
  );
}
