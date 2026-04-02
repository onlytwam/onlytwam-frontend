import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/store/authStore';
import { listNotifications } from '@/features/orders/api/orders.api';
import Breadcrumb from '@/shared/components/Breadcrumb';

export default function Notifications() {
  const qc = useQueryClient();
  const { getUserId } = useAuthStore();
  const userId = getUserId();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', userId],
    queryFn: () => listNotifications({ userProfileId: userId }),
    enabled: !!userId,
    select: (d: any) => d?.list ?? d ?? [],
  });

  const notifications = data ?? [];
  const unreadCount = notifications.filter((n: any) => !n.isRead).length;
  const formatDate = (d: string) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

  if (isLoading) return <div className="d-flex justify-content-center py-4"><div className="spinner-border text-secondary" /></div>;

  return (
    <>
      <Breadcrumb items={[
        { label: 'Home', path: '/' },
        { label: 'My Account', path: '/account/update-profile' },
        { label: 'Notifications' }
      ]} />
      <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h5 className="mb-0">
          Notifications
          {unreadCount > 0 && (
            <span className="badge bg-danger ms-2" style={{ fontSize: 12 }}>{unreadCount} new</span>
          )}
        </h5>
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-5">
          <i className="bi bi-bell" style={{ fontSize: 48, color: '#ddd' }} />
          <p className="text-muted mt-3">No notifications yet.</p>
        </div>
      ) : (
        <div>
          {notifications.map((notif: any, idx: number) => (
            <div
              key={notif.notificationId || idx}
              className={`d-flex gap-3 p-3 mb-2 rounded border ${!notif.isRead ? 'border-primary' : ''}`}
              style={{ background: notif.isRead ? '#fff' : '#f0f7ff', cursor: 'pointer' }}
            >
              <div
                style={{
                  width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                  background: notif.isRead ? '#f3f4f6' : '#dbeafe',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <i className={`bi ${notif.type === 'order' ? 'bi-bag' : notif.type === 'promo' ? 'bi-tag' : 'bi-bell'}`}
                  style={{ color: notif.isRead ? '#9ca3af' : '#3b82f6', fontSize: 18 }} />
              </div>
              <div className="flex-fill">
                <div className="d-flex justify-content-between align-items-start">
                  <p className="mb-1 fw-semibold" style={{ fontSize: 14 }}>{notif.title}</p>
                  <span className="text-muted" style={{ fontSize: 11 }}>{formatDate(notif.createdAt)}</span>
                </div>
                <p className="mb-0 text-muted" style={{ fontSize: 13 }}>{notif.message}</p>
              </div>
              {!notif.isRead && (
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', flexShrink: 0, marginTop: 6 }} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
    </>
  );
}
