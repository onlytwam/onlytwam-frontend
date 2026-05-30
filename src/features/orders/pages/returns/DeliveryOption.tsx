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
    <div className="container s-deliveryopti-562975">
      <p className="s-deliveryopti-78aac5">How would you like to send back the item?</p>

      {DELIVERY_OPTIONS.map(opt => (
        <div key={opt.id} onClick={() => setSelected(opt.id)}
          className="s-deliveryopti-132106" style={ {border: `2px solid ${selected === opt.id ? '#000000' : 'var(--ivory)'}`, background: selected === opt.id ? 'var(--ivory)' : '#fff'} }>
          <div className="s-deliveryopti-f08f4d" style={ {border: `2px solid ${selected === opt.id ? '#000000' : 'var(--ivory)'}`, background: selected === opt.id ? '#000000' : '#fff'} }>
            {selected === opt.id && <div className="s-payment-108f10" />}
          </div>
          <i className={`bi ${opt.icon} s-deliveryopti-55d2da`} />
          <div>
            <p className="s-shippingopti-b1d3de">{opt.label}</p>
            <p className="s-userdashboar-bc8be4">{opt.desc}</p>
          </div>
        </div>
      ))}

      <button onClick={handleNext} disabled={!selected}
        className="s-deliveryopti-69a55f" style={ {cursor: selected ? 'pointer' : 'not-allowed', opacity: selected ? 1 : 0.5} }>
        Continue <i className="bi bi-arrow-right ms-1" />
      </button>
    </div>
  );
}
