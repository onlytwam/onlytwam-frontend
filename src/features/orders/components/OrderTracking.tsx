// src/features/orders/components/OrderTracking.tsx — Fixed
// Displays live Ekart Elite tracking events from backend

import { useQuery } from '@tanstack/react-query';
import { trackShipment } from '@/features/orders/api/orders.api';

interface OrderTrackingProps {
  trackingId: string;
  orderNumber?: string;
  orderId?: number;
}

const STATUS_COLORS: Record<string, string> = {
  Delivered:            '#22c55e',
  delivered:            '#22c55e',
  'Out for Delivery':   '#f59e0b',
  out_for_delivery:     '#f59e0b',
  'In Transit':         '#3b82f6',
  in_transit:           '#3b82f6',
  Shipped:              '#6366f1',
  'Picked Up':          '#8b5cf6',
  Cancelled:            '#ef4444',
  cancelled:            '#ef4444',
  'Return Initiated':   '#f97316',
  default:              '#6b7280',
};

const STATUS_ICON: Record<string, string> = {
  delivered:          '✅',
  'Out for Delivery': '🚚',
  'In Transit':       '📦',
  'Picked Up':        '🏭',
  Cancelled:          '❌',
  default:            '📍',
};

function getStatusColor(s: string) {
  return STATUS_COLORS[s] || STATUS_COLORS.default;
}
function getStatusIcon(s: string) {
  return STATUS_ICON[s] || STATUS_ICON.default;
}

export default function OrderTracking({ trackingId, orderNumber }: OrderTrackingProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['tracking', trackingId],
    queryFn:  () => trackShipment(trackingId),
    enabled:  !!trackingId,
    refetchInterval: 5 * 60 * 1000, // refresh every 5 min
    staleTime: 60 * 1000,
  });

  if (!trackingId) {
    return (
      <div style={wrapStyle}>
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: '20px 0' }}>
          Tracking ID not available yet. Check back after shipment is dispatched.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={wrapStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#6b7280' }}>
          <span className="spinner-border spinner-border-sm" />
          <span>Fetching live tracking…</span>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div style={wrapStyle}>
        <p style={{ color: '#ef4444' }}>
          Could not fetch tracking info. Try again later.
        </p>
        <a
          href={`https://app.elite.ekartlogistics.in/track/${trackingId}`}
          target="_blank"
          rel="noreferrer"
          style={{ color: '#6B0F2A', fontSize: 14 }}
        >
          Track directly on Ekart ↗
        </a>
      </div>
    );
  }

  const liveStatus = data?.liveStatus || data?.orderState || 'Processing';
  const events: any[] = data?.trackingEvents || [];
  const estimatedDelivery = data?.estimatedDelivery;

  return (
    <div style={wrapStyle}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>Tracking ID</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1f2937', letterSpacing: 1 }}>{trackingId}</div>
          {orderNumber && (
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>Order #{orderNumber}</div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{
            background: getStatusColor(liveStatus) + '22',
            color: getStatusColor(liveStatus),
            border: `1.5px solid ${getStatusColor(liveStatus)}`,
            borderRadius: 20,
            padding: '4px 14px',
            fontSize: 13,
            fontWeight: 600,
          }}>
            {getStatusIcon(liveStatus)} {liveStatus}
          </span>
          {estimatedDelivery && (
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
              Est. delivery: {new Date(estimatedDelivery).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric'
              })}
            </div>
          )}
        </div>
      </div>

      {/* External link */}
      <a
        href={`https://app.elite.ekartlogistics.in/track/${trackingId}`}
        target="_blank"
        rel="noreferrer"
        style={{
          display: 'inline-block',
          marginBottom: 20,
          fontSize: 13,
          color: '#6B0F2A',
          textDecoration: 'underline',
        }}
      >
        View on Ekart website ↗
      </a>

      {/* Timeline */}
      {events.length === 0 ? (
        <div style={{ color: '#9ca3af', fontSize: 14, textAlign: 'center', padding: '16px 0' }}>
          No tracking events yet. Package may be awaiting pickup.
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          {events.map((evt: any, i: number) => (
            <div key={i} style={{ display: 'flex', gap: 14, marginBottom: i < events.length - 1 ? 20 : 0 }}>
              {/* Timeline line + dot */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 24 }}>
                <div style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: i === 0 ? getStatusColor(evt.status) : '#d1d5db',
                  border: `2.5px solid ${i === 0 ? getStatusColor(evt.status) : '#e5e7eb'}`,
                  flexShrink: 0,
                  marginTop: 3,
                }} />
                {i < events.length - 1 && (
                  <div style={{ width: 2, flex: 1, background: '#e5e7eb', marginTop: 4 }} />
                )}
              </div>
              {/* Event text */}
              <div style={{ flex: 1, paddingBottom: 4 }}>
                <div style={{
                  fontWeight: i === 0 ? 700 : 500,
                  fontSize: 14,
                  color: i === 0 ? '#1f2937' : '#374151',
                }}>
                  {evt.status}
                </div>
                {evt.location && (
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                    📍 {evt.location}
                  </div>
                )}
                {evt.remarks && evt.remarks.trim() && (
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                    {evt.remarks}
                  </div>
                )}
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                  {evt.timestamp
                    ? new Date(evt.timestamp).toLocaleString('en-IN', {
                        day: 'numeric', month: 'short',
                        hour: '2-digit', minute: '2-digit',
                      })
                    : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const wrapStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  border: '1px solid #e5e7eb',
  padding: '20px 24px',
  margin: '0 0 20px 0',
};
