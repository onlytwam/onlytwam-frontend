import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/store/authStore';
import { listNotifications } from '@/features/orders/api/orders.api';

export default function Notifications() {
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
      <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h5 className="mb-0">
          Notifications
          {unreadCount > 0 && (
            <span className="badge bg-danger ms-2 s-couponslist-030edf">{unreadCount} new</span>
          )}
        </h5>
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-5">
          <i className="bi bi-bell s-addresslist-d71ded" />
          <p className="text-muted mt-3">No notifications yet.</p>
        </div>
      ) : (
        <div>
          {notifications.map((notif: any, idx: number) => (
            <div
              key={notif.notificationId || idx}
              className={`d-flex gap-3 p-3 mb-2 rounded border ${!notif.isRead ? 'border-primary' : ''} s-notification-6de659`} style={ {background: notif.isRead ? '#fff' : 'var(--ivory)'} }
            >
              <div
                className="s-notification-9088a7" style={ {background: notif.isRead ? 'var(--ivory)' : 'var(--ivory)'} }
              >
                <i className={`bi ${notif.type === 'order' ? 'bi-bag' : notif.type === 'promo' ? 'bi-tag' : 'bi-bell'} s-notification-f4946d`} style={ {color: notif.isRead ? 'var(--heirloom)' : 'var(--brand)'} } />
              </div>
              <div className="flex-fill">
                <div className="d-flex justify-content-between align-items-start">
                  <p className="mb-1 fw-semibold s-addresslist-92985e">{notif.title}</p>
                  <span className="text-muted s-addresslist-2c42ad">{formatDate(notif.createdAt)}</span>
                </div>
                <p className="mb-0 text-muted s-addresslist-9eec06">{notif.message}</p>
              </div>
              {!notif.isRead && (
                <div className="s-notification-f487a5" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
    </>
  );
}
