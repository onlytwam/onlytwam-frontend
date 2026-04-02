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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid #f0f0f0' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Order Tracking</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#555' }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <div style={{ width: 36, height: 36, border: '3px solid #eee', borderTopColor: '#111', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
            </div>
          ) : steps.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#aaa' }}>
              <i className="bi bi-geo-alt" style={{ fontSize: 40, display: 'block', marginBottom: 12 }} />
              <p>No tracking information available yet.</p>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              {steps.map((step: any, i: number) => {
                const isDone = step.status === 'completed' || step.status === 'done';
                const isActive = step.status === 'active' || step.status === 'current';
                const color = isDone ? '#2e7d32' : isActive ? '#6A012A' : '#ccc';
                return (
                  <div key={i} style={{ display: 'flex', gap: 16, paddingBottom: i < steps.length - 1 ? 24 : 0, position: 'relative' }}>
                    {/* Line */}
                    {i < steps.length - 1 && (
                      <div style={{ position: 'absolute', left: 13, top: 28, width: 2, height: 'calc(100% - 4px)', background: isDone ? '#2e7d32' : '#eee' }} />
                    )}
                    {/* Circle */}
                    <div style={{ flexShrink: 0, width: 28, height: 28, borderRadius: '50%', background: isDone ? '#2e7d32' : isActive ? '#6A012A' : '#fff', border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                      {isDone
                        ? <i className="bi bi-check" style={{ color: '#fff', fontSize: 14 }} />
                        : <div style={{ width: 8, height: 8, borderRadius: '50%', background: isActive ? '#fff' : '#eee' }} />
                      }
                    </div>
                    {/* Content */}
                    <div style={{ flex: 1, paddingTop: 2 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: isDone || isActive ? '#111' : '#aaa' }}>{step.title}</h4>
                        {step.date && <span style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap', marginLeft: 8 }}>
                          {new Date(step.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>}
                      </div>
                      {step.description && (
                        <p style={{ margin: 0, fontSize: 13, color: '#666' }}
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
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}