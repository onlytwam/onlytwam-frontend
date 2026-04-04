import { useQuery } from '@tanstack/react-query';
import api from '@/shared/api/axiosInstance';

interface Props {
  orderId: number;
  onClose: () => void;
}

export default function OrderTracking({ orderId, onClose }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['order-tracking', orderId],
    // FIX: route is POST /Orders/order-tracking (lowercase, hyphenated), not /Orders/OrderTracking
    queryFn: () => api.post('/Orders/order-tracking', { orderId }).then(r => r.data),
    enabled: orderId > 0,
  });

  const steps: any[] = data?.steps ?? [];

  return (
    <div className="s-ordertrackin-308df5"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="s-ordertrackin-afecf3">

        {/* Header */}
        <div className="s-ordertrackin-96a869">
          <h3 className="s-adminproduct-53697f">Order Tracking</h3>
          <button onClick={onClose} className="s-ordertrackin-47a107">×</button>
        </div>

        {/* Body */}
        <div className="s-ordertrackin-85fdca">
          {isLoading ? (
            <div className="s-quickcart-9164c7">
              <div className="s-blog1-da8e4b" />
            </div>
          ) : steps.length === 0 ? (
            <div className="s-ordertrackin-08936b">
              <i className="bi bi-geo-alt s-adminproduct-8eb3fc" />
              <p>No tracking information available yet.</p>
            </div>
          ) : (
            <div className="s-updateprofil-1d5e50">
              {steps.map((step: any, i: number) => {
                const isDone = step.status === 'completed' || step.status === 'done';
                const isActive = step.status === 'active' || step.status === 'current';
                const color = isDone ? 'var(--brand)' : isActive ? 'var(--brand)' : 'var(--ivory)';
                return (
                  <div key={i} className="s-ordertrackin-b2a7c8" style={ {paddingBottom: i < steps.length - 1 ? 24 : 0} }>
                    {/* Line */}
                    {i < steps.length - 1 && (
                      <div className="s-ordertrackin-2a75ac" style={ {background: isDone ? 'var(--brand)' : 'var(--ivory)'} } />
                    )}
                    {/* Circle */}
                    <div className="s-ordertrackin-fa1352" style={{ background: isDone ? 'var(--brand)' : isActive ? 'var(--brand)' : '#fff', border: `2px solid ${color}` }}>
                      {isDone
                        ? <i className="bi bi-check s-ordertrackin-916252" />
                        : <div className="s-ordertrackin-890630" style={ {background: isActive ? '#fff' : 'var(--ivory)'} } />
                      }
                    </div>
                    {/* Content */}
                    <div className="s-ordertrackin-27fb35">
                      <div className="s-ordertrackin-4f2d7d">
                        <h4 className="s-ordertrackin-388537" style={ {color: isDone || isActive ? '#000000' : 'var(--heirloom)'} }>{step.title}</h4>
                        {step.date && <span className="s-ordertrackin-c429f0">
                          {new Date(step.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>}
                      </div>
                      {step.description && (
                        <p className="s-userdashboar-bc8be4"
                          dangerouslySetInnerHTML={{ __html: step.description }} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      </div>
  );
}