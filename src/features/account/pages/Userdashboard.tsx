/**
 * UserDashboard.tsx – Premium Dashboard with embedded Orders & Wishlist
 * Tabs: Overview | My Orders | My Wishlist
 */

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/features/auth/store/authStore';
import { listOrders } from '@/features/orders/api/orders.api';
import { listUserCoupons, listAddress } from '@/features/orders/api/orders.api';
import { listWishlist, deleteWishlistVariant } from '@/features/products/api/products.api';
import { useWishlistStore } from '@/shared/store/wishlistStore';
import ProductCard from '@/features/products/components/ProductCard';
import QuickShopModal from '@/features/products/components/QuickShopModal';

const PRI = '#6B0F2A';
const HEIRLOOM = '#9E6070';
const BLUSH = '#A84C6B';
const IVORY = '#F5F0E6';
const DARK = '#2D1B20';
const LIGHT_BORDER = '#E8DED1';

const SERIF = '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif';
const SANS = '"Trebuchet MS", "Gill Sans", Arial, sans-serif';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  Pending: { bg: '#FFF8E1', text: '#F59E0B' },
  Confirmed: { bg: '#E3F2FD', text: '#1565C0' },
  Processing: { bg: '#F3E5F5', text: '#6A1B9A' },
  Shipped: { bg: '#E0F7FA', text: '#006064' },
  Delivered: { bg: '#E8F5E9', text: '#1B5E20' },
  Cancelled: { bg: '#FFEBEE', text: '#B71C1C' },
  Returned: { bg: '#FAFAFA', text: '#616161' },
  'Return Initiated': { bg: '#FFF3E0', text: '#E65100' },
  Refunded: { bg: '#F5F5F5', text: '#455A64' },
  Failed: { bg: '#FFEBEE', text: '#B71C1C' },
};

const ORDER_FILTERS = ['All', 'Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

function ProfileAvatar({ name, size = 120 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `linear-gradient(135deg, ${PRI}, ${BLUSH})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontSize: size * 0.35, fontWeight: 700, fontFamily: SERIF,
      boxShadow: '0 8px 32px rgba(107, 15, 42, 0.2)', border: '4px solid #fff', position: 'relative',
    }}>
      {initials || <i className="bi bi-person-fill" />}
      <div style={{
        position: 'absolute', bottom: 4, right: 4, width: 16, height: 16,
        background: '#4CAF50', borderRadius: '50%', border: '3px solid #fff',
      }} />
    </div>
  );
}

function StatCard({ icon, label, value, onClick }: { icon: string; label: string; value: string | number; onClick?: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        background: '#fff', border: `2px solid ${hovered ? PRI : LIGHT_BORDER}`, borderRadius: 16, padding: '24px',
        cursor: onClick ? 'pointer' : 'default', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: hovered ? 'translateY(-4px)' : 'none',
        boxShadow: hovered ? '0 12px 40px rgba(107, 15, 42, 0.12)' : '0 2px 8px rgba(0, 0, 0, 0.04)',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14, background: hovered ? `${PRI}12` : IVORY,
          display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s ease',
        }}>
          <i className={`bi ${icon}`} style={{ fontSize: 24, color: hovered ? PRI : HEIRLOOM }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: PRI, fontFamily: SERIF, lineHeight: 1 }}>{value}</div>
          <div style={{ fontSize: 13, color: '#666', marginTop: 6, fontFamily: SANS, letterSpacing: '0.3px' }}>{label}</div>
        </div>
      </div>
    </div>
  );
}

export default function UserDashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, getUserId, getUserName, setWishlistCount, wishlistCount } = useAuthStore();
  const { removeId: removeWishlistId, reset: resetWishlistStore } = useWishlistStore();
  const userId = getUserId();
  const userName = getUserName();

  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'wishlist'>('overview');
  const [orderFilter, setOrderFilter] = useState('All');
  const [orderPage, setOrderPage] = useState(1);
  const [quickShopId, setQuickShopId] = useState<number | null>(null);

  const { data: ordersData } = useQuery({
    queryKey: ['dashboard-orders', userId, orderFilter, orderPage],
    queryFn: () => listOrders({
      userProfileId: userId,
      pageSize: 50,
      ...(orderFilter !== 'All' ? { state: orderFilter } : {}),
    }),
    enabled: !!userId,
  });

  const { data: addressData } = useQuery({
    queryKey: ['addresses', userId],
    queryFn: () => listAddress({ userProfileId: userId }),
    enabled: !!userId,
  });

  const { data: couponsData } = useQuery({
    queryKey: ['coupons', userId],
    queryFn: () => listUserCoupons({ userProfileId: userId }),
    enabled: !!userId,
  });

  const { data: wishlistData } = useQuery({
    queryKey: ['wishlist', userId],
    queryFn: () => listWishlist({ userProfileId: userId }),
    enabled: !!userId,
  });

  const orders = ordersData?.list ?? ordersData?.data ?? ordersData ?? [];
  const totalOrders = ordersData?.totalCount ?? ordersData?.total ?? (Array.isArray(orders) ? orders.length : 0);
  const addresses = addressData?.list ?? addressData?.data ?? addressData ?? [];
  const coupons = couponsData?.list ?? couponsData?.data ?? couponsData ?? [];
  const wishlist = wishlistData?.list ?? wishlistData?.data ?? wishlistData ?? [];

  const email = (user as any)?.email || (user as any)?.emailId || '';
  const phone = (user as any)?.phoneNumber || (user as any)?.phone || '';

  const activeCoupons = Array.isArray(coupons)
    ? coupons.filter((c: any) => c.state !== 'Expired' && c.state !== 'Used')
    : [];

  // Normalize wishlist items for ProductCard
  const wishlistItems = (Array.isArray(wishlist) ? wishlist : []).map((item: any) => ({
    productId: item.productId,
    productVariantId: item.productVariantId,
    productVariantDetailId: item.productVariantDetailId,
    name: item.productName || item.productname || item.variantName || item.name || 'Product',
    image: item.imageURL || item.imageurl || item.image || '',
    price: item.finalPrice || item.finalprice || item.price || 0,
    oldPrice: item.mrpPrice || item.mrpprice || item.oldPrice || 0,
    rating: item.rating || 0,
    color: item.colorName || item.color || '',
    colorName: item.colorName || item.color || '',
    colorHex: item.colorHex || '',
    brandName: item.brandName || '',
  }));

  useEffect(() => {
    setWishlistCount(wishlistItems.length);
  }, [wishlistItems.length]);

  const handleRemoveWishlist = async (pvId: number) => {
    try {
      await deleteWishlistVariant(pvId);
      qc.invalidateQueries({ queryKey: ['wishlist', userId] });
      removeWishlistId(pvId);
      setWishlistCount(Math.max(0, wishlistCount - 1));
      toast('Removed from wishlist', { icon: '💔' });
    } catch {
      toast.error('Could not remove');
    }
  };

  const TABS = [
    { key: 'overview' as const, label: 'Overview', icon: 'bi-grid-1x2' },
    { key: 'orders' as const, label: 'My Orders', icon: 'bi-bag-check' },
    { key: 'wishlist' as const, label: `Wishlist (${wishlistItems.length})`, icon: 'bi-heart' },
  ];

  const profileComplete = [userName, email, phone].filter(Boolean).length;
  const profilePct = Math.round((profileComplete / 3) * 100);

  return (
    <div style={{ fontFamily: SANS, minHeight: '100vh' }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
        .fade-in { animation: fadeIn 0.5s ease forwards; }
        .order-row:hover { background: ${PRI}05 !important; }
        @media (max-width: 1024px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .dash-tab-bar { flex-wrap: wrap !important; }
        }
        @media (max-width: 640px) {
          .stats-grid { grid-template-columns: 1fr !important; }
          .wl-dash-grid { grid-template-columns: repeat(2,1fr) !important; }
          .dash-actions-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>

      {/* ── Welcome Card ── */}
      <div className="fade-in" style={{
        background: '#fff', borderRadius: 20, padding: '32px',
        marginBottom: 24, boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
        border: `1px solid ${LIGHT_BORDER}`, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: `${PRI}06` }} />
        <div style={{ position: 'absolute', bottom: -30, right: 80, width: 100, height: 100, borderRadius: '50%', background: `${BLUSH}08` }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 28, position: 'relative', flexWrap: 'wrap' }}>
          <ProfileAvatar name={userName || 'U'} size={90} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ margin: '0 0 2px', fontSize: 12, color: '#666', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: SANS }}>Welcome back,</p>
            <h2 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 700, fontFamily: SERIF, color: DARK }}>{userName || 'Guest'}</h2>
            {email && <p style={{ margin: 0, fontSize: 13, color: '#666' }}>{email}</p>}
            {phone && <p style={{ margin: '2px 0 0', fontSize: 13, color: '#666' }}>{phone}</p>}
          </div>
          <button
            onClick={() => navigate('/account/update-profile')}
            style={{
              background: PRI, border: 'none', color: '#fff', padding: '10px 24px', borderRadius: 10,
              cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: SANS,
              display: 'flex', alignItems: 'center', gap: 8, boxShadow: `0 4px 16px ${PRI}40`,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#5A0C23'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = PRI; e.currentTarget.style.transform = 'none'; }}
          >
            <i className="bi bi-pencil" /> Edit Profile
          </button>
        </div>

        {/* Profile Completion */}
        {profilePct < 100 && (
          <div style={{ marginTop: 24, padding: '16px', background: IVORY, borderRadius: 12, border: `1px solid ${LIGHT_BORDER}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#666', fontWeight: 600 }}>Profile Completion</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: PRI }}>{profilePct}%</span>
            </div>
            <div style={{ height: 6, background: '#E0D5C7', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${profilePct}%`, background: `linear-gradient(90deg, ${PRI}, ${BLUSH})`, borderRadius: 99, transition: 'width 0.6s ease' }} />
            </div>
          </div>
        )}
      </div>

      {/* ── Stats Grid ── */}
      <div className="stats-grid fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard icon="bi-bag-check-fill" label="Total Orders" value={totalOrders || 0} onClick={() => setActiveTab('orders')} />
        <StatCard icon="bi-heart-fill" label="Wishlist Items" value={wishlistItems.length} onClick={() => setActiveTab('wishlist')} />
        <StatCard icon="bi-ticket-perforated-fill" label="Active Coupons" value={activeCoupons.length} onClick={() => navigate('/account/coupons-list')} />
        <StatCard icon="bi-geo-alt-fill" label="Saved Addresses" value={(Array.isArray(addresses) ? addresses : []).length} onClick={() => navigate('/account/address-list')} />
      </div>

      {/* ── Tab Navigation ── */}
      <div className="dash-tab-bar" style={{
        display: 'flex', gap: 4, marginBottom: 24, background: '#fff', borderRadius: 14,
        padding: 4, border: `1px solid ${LIGHT_BORDER}`, boxShadow: '0 2px 8px rgba(0,0,0,.04)',
      }}>
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            flex: 1, padding: '12px 16px', border: 'none', borderRadius: 10, cursor: 'pointer',
            fontSize: 14, fontWeight: activeTab === tab.key ? 700 : 500,
            fontFamily: SANS, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: activeTab === tab.key ? PRI : 'transparent',
            color: activeTab === tab.key ? '#fff' : '#666',
            transition: 'all .2s ease',
          }}>
            <i className={`bi ${tab.icon}`} style={{ fontSize: 16 }} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
         OVERVIEW TAB
         ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="fade-in">
          {/* Quick Actions */}
          <div style={{
            background: '#fff', borderRadius: 16, border: `1px solid ${LIGHT_BORDER}`,
            overflow: 'hidden', marginBottom: 24, boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
          }}>
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${LIGHT_BORDER}` }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, fontFamily: SERIF, color: DARK }}>
                <i className="bi bi-grid-3x3-gap-fill" style={{ marginRight: 10, color: PRI }} />Quick Actions
              </h3>
            </div>
            <div className="dash-actions-grid" style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                { icon: 'bi-person-fill', label: 'My Profile', to: '/account/update-profile' },
                { icon: 'bi-geo-alt-fill', label: 'Addresses', to: '/account/address-list' },
                { icon: 'bi-ticket-perforated-fill', label: 'Coupons', to: '/account/coupons-list' },
                { icon: 'bi-bell-fill', label: 'Notifications', to: '/account/notifications' },
                { icon: 'bi-question-circle-fill', label: 'Help Center', to: '/help-center' },
                { icon: 'bi-lock-fill', label: 'Change Password', to: '/account/change-password' },
              ].map(link => (
                <div key={link.to} onClick={() => navigate(link.to)} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                  background: IVORY, borderRadius: 12, cursor: 'pointer', transition: 'all .2s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${PRI}10`; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = IVORY; e.currentTarget.style.transform = 'none'; }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, background: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <i className={`bi ${link.icon}`} style={{ fontSize: 18, color: PRI }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: DARK, fontFamily: SANS }}>{link.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Orders Preview */}
          {(Array.isArray(orders) ? orders : []).length > 0 && (
            <div style={{
              background: '#fff', borderRadius: 16, border: `1px solid ${LIGHT_BORDER}`,
              overflow: 'hidden', marginBottom: 24, boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
            }}>
              <div style={{ padding: '20px 24px', borderBottom: `1px solid ${LIGHT_BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, fontFamily: SERIF, color: DARK }}>
                  <i className="bi bi-bag-check-fill" style={{ marginRight: 10, color: PRI }} />Recent Orders
                </h3>
                <button onClick={() => setActiveTab('orders')} style={{
                  fontSize: 13, color: PRI, background: 'none', border: 'none', cursor: 'pointer',
                  fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  View All <i className="bi bi-arrow-right" />
                </button>
              </div>
              {(Array.isArray(orders) ? orders.slice(0, 3) : []).map((order: any) => {
                const status = order.state || order.status || 'Pending';
                const sColor = STATUS_COLORS[status] || { bg: '#f5f5f5', text: '#555' };
                const items = order.orderDetails || order.items || [];
                const firstImg = items[0]?.productImage || items[0]?.image;
                return (
                  <div key={order.orderId} className="order-row"
                    onClick={() => navigate(`/order-details/${order.orderId}`)}
                    style={{
                      padding: '16px 24px', borderBottom: `1px solid ${LIGHT_BORDER}`,
                      cursor: 'pointer', transition: 'background 0.2s', display: 'flex', alignItems: 'center', gap: 16,
                    }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: 10, background: IVORY, flexShrink: 0,
                      overflow: 'hidden', border: `1px solid ${LIGHT_BORDER}`,
                    }}>
                      {firstImg ? (
                        <img
                          src={firstImg.startsWith('http') ? firstImg : `${((import.meta as any).env?.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api').replace(/\/api$/, '')}${firstImg}`}
                          alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <i className="bi bi-box" style={{ fontSize: 22, color: '#ccc' }} />
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: DARK }}>Order #{String(order.orderId).slice(-6)}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: sColor.bg, color: sColor.text, flexShrink: 0 }}>{status}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                        {items.length} item{items.length !== 1 ? 's' : ''} · ₹{order.subTotal || order.totalAmount || 0}
                      </div>
                    </div>
                    <i className="bi bi-chevron-right" style={{ fontSize: 14, color: '#ccc' }} />
                  </div>
                );
              })}
            </div>
          )}

          {/* Active Coupons Preview */}
          {activeCoupons.length > 0 && (
            <div style={{
              background: '#fff', borderRadius: 16, border: `1px solid ${LIGHT_BORDER}`,
              overflow: 'hidden', boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
            }}>
              <div style={{ padding: '20px 24px', borderBottom: `1px solid ${LIGHT_BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, fontFamily: SERIF, color: DARK }}>
                  <i className="bi bi-ticket-perforated-fill" style={{ marginRight: 10, color: PRI }} />Active Coupons
                </h3>
                <Link to="/account/coupons-list" style={{ fontSize: 13, color: PRI, textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  View All <i className="bi bi-arrow-right" />
                </Link>
              </div>
              <div style={{ display: 'flex', gap: 16, padding: '20px 24px', overflowX: 'auto' }}>
                {activeCoupons.slice(0, 4).map((coupon: any, i: number) => (
                  <div key={i} style={{
                    flexShrink: 0, minWidth: 200, borderRadius: 14,
                    background: `linear-gradient(135deg, ${PRI}08, ${PRI}15)`,
                    border: `2px dashed ${PRI}40`, padding: '18px',
                  }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: PRI, fontFamily: SERIF, marginBottom: 6, letterSpacing: '0.5px' }}>
                      {coupon.couponCode || coupon.code}
                    </div>
                    <div style={{ fontSize: 13, color: HEIRLOOM, fontWeight: 600 }}>
                      {coupon.discountType === 'Percentage' ? `${coupon.discountValue}% off` : `₹${coupon.discountValue} off`}
                    </div>
                    {coupon.minOrderValue && (
                      <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>Min order ₹{coupon.minOrderValue}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
         ORDERS TAB
         ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'orders' && (
        <div className="fade-in">
          {/* Order filter pills */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
            {ORDER_FILTERS.map(f => (
              <button key={f} onClick={() => { setOrderFilter(f); setOrderPage(1); }} style={{
                padding: '8px 16px', border: `1.5px solid ${orderFilter === f ? PRI : '#ddd'}`,
                background: orderFilter === f ? PRI : '#fff', color: orderFilter === f ? '#fff' : '#444',
                borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: orderFilter === f ? 700 : 500,
                fontFamily: SANS, transition: 'all .2s',
              }}>
                {f}
              </button>
            ))}
          </div>

          {/* Orders list */}
          <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${LIGHT_BORDER}`, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.04)' }}>
            {(Array.isArray(orders) ? orders : []).length === 0 ? (
              <div style={{ padding: '60px 28px', textAlign: 'center' }}>
                <i className="bi bi-bag" style={{ fontSize: 56, color: '#ddd', display: 'block', marginBottom: 12 }} />
                <p style={{ margin: '0 0 20px', color: '#aaa', fontSize: 15 }}>
                  {orderFilter === 'All' ? 'No orders yet' : `No ${orderFilter.toLowerCase()} orders`}
                </p>
                <button onClick={() => navigate('/user-products/product-list')} style={{
                  background: PRI, color: '#fff', border: 'none', padding: '12px 28px', borderRadius: 10,
                  cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: SANS,
                }}>
                  Start Shopping
                </button>
              </div>
            ) : (
              (Array.isArray(orders) ? orders : []).map((order: any) => {
                const status = order.state || order.status || 'Pending';
                const sColor = STATUS_COLORS[status] || { bg: '#f5f5f5', text: '#555' };
                const items = order.orderDetails || order.items || [];
                const firstImg = items[0]?.productImage || items[0]?.image;

                return (
                  <div key={order.orderId} className="order-row"
                    onClick={() => navigate(`/order-details/${order.orderId}`)}
                    style={{
                      padding: '18px 24px', borderBottom: `1px solid ${LIGHT_BORDER}`,
                      cursor: 'pointer', transition: 'background 0.2s', display: 'flex', alignItems: 'center', gap: 18,
                    }}>
                    <div style={{
                      width: 64, height: 64, borderRadius: 12, background: IVORY, flexShrink: 0,
                      overflow: 'hidden', border: `1px solid ${LIGHT_BORDER}`,
                    }}>
                      {firstImg ? (
                        <img
                          src={firstImg.startsWith('http') ? firstImg : `${((import.meta as any).env?.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api').replace(/\/api$/, '')}${firstImg}`}
                          alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <i className="bi bi-box" style={{ fontSize: 24, color: '#ccc' }} />
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: DARK, fontFamily: SANS }}>
                          Order #{String(order.orderId).slice(-6)}
                        </span>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 6,
                          background: sColor.bg, color: sColor.text, flexShrink: 0, letterSpacing: '0.3px',
                        }}>
                          {status}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
                        {items.length} item{items.length !== 1 ? 's' : ''} · ₹{order.subTotal || order.totalAmount || 0}
                      </div>
                      {order.createdDate && (
                        <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>
                          {new Date(order.createdDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      )}
                    </div>
                    <i className="bi bi-chevron-right" style={{ fontSize: 16, color: '#ccc' }} />
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
         WISHLIST TAB
         ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'wishlist' && (
        <div className="fade-in">
          {wishlistItems.length === 0 ? (
            <div style={{
              background: '#fff', borderRadius: 16, border: `1px solid ${LIGHT_BORDER}`,
              padding: '60px 28px', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,.04)',
            }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%', background: IVORY,
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
              }}>
                <i className="bi bi-heart" style={{ fontSize: 36, color: HEIRLOOM }} />
              </div>
              <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: PRI, fontFamily: SERIF }}>Your wishlist is empty</h3>
              <p style={{ margin: '0 0 20px', color: HEIRLOOM, fontSize: 14 }}>
                Save items you love by clicking the heart icon on any product.
              </p>
              <button onClick={() => navigate('/user-products/product-list')} style={{
                background: PRI, color: '#fff', border: 'none', padding: '12px 28px', borderRadius: 10,
                cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: SERIF,
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}>
                <i className="bi bi-arrow-left" /> Browse Products
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <p style={{ margin: 0, fontSize: 14, color: HEIRLOOM, fontWeight: 500 }}>
                  {wishlistItems.length} saved item{wishlistItems.length !== 1 ? 's' : ''}
                </p>
                <button onClick={() => {
                  Promise.all((Array.isArray(wishlist) ? wishlist : []).map((i: any) => deleteWishlistVariant(i.productVariantId)))
                    .then(() => {
                      qc.invalidateQueries({ queryKey: ['wishlist', userId] });
                      resetWishlistStore();
                      setWishlistCount(0);
                    })
                    .catch(() => toast.error('Could not clear wishlist'));
                  toast.success('Wishlist cleared');
                }} style={{
                  background: 'none', border: `1.5px solid ${HEIRLOOM}`, color: HEIRLOOM,
                  padding: '7px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontFamily: SANS,
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>
                  <i className="bi bi-trash3" /> Clear all
                </button>
              </div>
              <div className="wl-dash-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {wishlistItems.map((item: any) => (
                  <ProductCard
                    key={item.productVariantId}
                    product={item}
                    onQuickShop={(id) => setQuickShopId(id)}
                    onRemove={() => handleRemoveWishlist(item.productVariantId)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {quickShopId && (
        <QuickShopModal productVariantId={quickShopId} onClose={() => setQuickShopId(null)} />
      )}
    </div>
  );
}
