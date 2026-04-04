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
    <div className="container s-deliveryopti-562975">
      <button onClick={() => navigate('/user-products/delivery-option')}
        className="s-deliveryopti-01d82d">
        <i className="bi bi-arrow-left" /> Back
      </button>
      <h4 className="s-deliveryopti-186182">How would you like your refund?</h4>
      <p className="s-deliveryopti-78aac5">Choose your preferred refund method.</p>

      {REFUND_OPTIONS.map(opt => (
        <div key={opt.id} onClick={() => setSelected(opt.id)}
          className="s-refundchoice-4412c0" style={ {border: `2px solid ${selected === opt.id ? '#000000' : 'var(--ivory)'}`, background: selected === opt.id ? 'var(--ivory)' : '#fff'} }>
          <div className="s-refundchoice-c5ab4c" style={ {border: `2px solid ${selected === opt.id ? '#000000' : 'var(--ivory)'}`, background: selected === opt.id ? '#000000' : '#fff'} }>
            {selected === opt.id && <div className="s-payment-108f10" />}
          </div>
          <i className={`bi ${opt.icon} s-refundchoice-06223b`} />
          <div>
            <p className="s-shippingopti-b1d3de">{opt.label}</p>
            <p className="s-userdashboar-a9730b">{opt.desc}</p>
          </div>
        </div>
      ))}

      <button onClick={handleNext} disabled={!selected}
        className="s-refundchoice-5b0ee3" style={ {cursor: selected ? 'pointer' : 'not-allowed', opacity: selected ? 1 : 0.5} }>
        Review Return <i className="bi bi-arrow-right ms-1" />
      </button>
    </div>
  );
}
