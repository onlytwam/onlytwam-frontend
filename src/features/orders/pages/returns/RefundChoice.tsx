import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const REFUND_OPTIONS = [
  { id: 'original', label: 'Refund to Original Payment', icon: 'bi-credit-card', desc: 'Amount will be credited back to your original payment method in 5–7 business days' },
  { id: 'wallet', label: 'Store Credit / Wallet', icon: 'bi-wallet2', desc: 'Get instant store credit for your next purchase' },
  { id: 'exchange', label: 'Exchange for Another Size', icon: 'bi-arrow-left-right', desc: 'We will send the correct size once we receive your return' },
];

export default function RefundChoice() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState('');

  const handleNext = () => {
    if (!selected) return;
    const returnData = JSON.parse(sessionStorage.getItem('returnOrder') || '{}');
    sessionStorage.setItem('returnOrder', JSON.stringify({ ...returnData, refundChoice: selected }));
    navigate('/user-products/return-confirm');
  };

  return (
    <div className="container" style={{ padding: '32px 16px', maxWidth: 520 }}>
      <button onClick={() => navigate('/user-products/delivery-option')}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
        <i className="bi bi-arrow-left" /> Back
      </button>
      <h4 style={{ marginBottom: 6 }}>How would you like your refund?</h4>
      <p style={{ color: '#888', marginBottom: 24, fontSize: 14 }}>Choose your preferred refund method.</p>

      {REFUND_OPTIONS.map(opt => (
        <div key={opt.id} onClick={() => setSelected(opt.id)}
          style={{ display: 'flex', alignItems: 'flex-start', gap: 16, border: `2px solid ${selected === opt.id ? '#111' : '#eee'}`, borderRadius: 8, padding: 16, marginBottom: 12, cursor: 'pointer', background: selected === opt.id ? '#f9f9f9' : '#fff' }}>
          <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${selected === opt.id ? '#111' : '#ccc'}`, background: selected === opt.id ? '#111' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
            {selected === opt.id && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
          </div>
          <i className={`bi ${opt.icon}`} style={{ fontSize: 22, color: '#555', flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{opt.label}</p>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#888' }}>{opt.desc}</p>
          </div>
        </div>
      ))}

      <button onClick={handleNext} disabled={!selected}
        style={{ marginTop: 16, width: '100%', background: '#111', color: '#fff', border: 'none', padding: '12px', borderRadius: 4, cursor: selected ? 'pointer' : 'not-allowed', opacity: selected ? 1 : 0.5, fontWeight: 600 }}>
        Review Return <i className="bi bi-arrow-right ms-1" />
      </button>
    </div>
  );
}
