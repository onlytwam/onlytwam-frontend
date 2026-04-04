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



const LIGHT_BORDER = '#f5f0e6';
const SERIF = '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif';
const SANS = '"Trebuchet MS", "Gill Sans", Arial, sans-serif';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  Pending: { bg: 'var(--ivory)', text: 'var(--brand)' },
  Confirmed: { bg: 'var(--ivory)', text: 'var(--brand)' },
  Processing: { bg: 'var(--ivory)', text: 'var(--brand)' },
  Shipped: { bg: 'var(--ivory)', text: 'var(--brand)' },
  Delivered: { bg: 'var(--ivory)', text: 'var(--brand)' },
  Cancelled: { bg: 'var(--ivory)', text: 'var(--brand)' },
  Returned: { bg: 'var(--ivory)', text: 'var(--heirloom)' },
  'Return Initiated': { bg: 'var(--ivory)', text: 'var(--brand)' },
  Refunded: { bg: 'var(--ivory)', text: 'var(--heirloom)' },
  Failed: { bg: 'var(--ivory)', text: 'var(--brand)' },
};

const ORDER_FILTERS = ['All', 'Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

function ProfileAvatar({ name, size = 120 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="s-userdashboar-4bb945" style={ {width: size, height: size, fontFamily: SERIF} }>
      {initials || <i className="bi bi-person-fill" />}
      <div className="s-userdashboar-910431" />
    </div>
  );
}

function StatCard({ icon, label, value, onClick }: { icon: string; label: string; value: string | number; onClick?: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      className="s-userdashboar-c13cc7" style={ {border: `2px solid ${hovered ? 'var(--brand)' : LIGHT_BORDER}`, cursor: onClick ? 'pointer' : 'default', transform: hovered ? 'translateY(-4px)' : 'none', boxShadow: hovered ? '0 12px 40px rgba(107, 15, 42, 0.12)' : '0 2px 8px rgba(0, 0, 0, 0.04)'} }>
      <div className="s-userdashboar-83c582">
        <div className="s-userdashboar-adc1c0" style={ {background: hovered ? `rgba(107,15,42,0.07)` : 'var(--ivory)'} }>
          <i className={`bi ${icon} s-userdashboar-e41cf0`} style={ {color: hovered ? 'var(--brand)' : 'var(--heirloom)'} } />
        </div>
        <div className="s-app-52dcac">
          <div className="s-userdashboar-3d403b twam-font-heading">{value}</div>
          <div className="s-userdashboar-d961a8 twam-font-body">{label}</div>
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
    <div className="s-userdashboar-e04c1b twam-font-body">

      {/* ── Welcome Card ── */}
      <div className="fade-in s-userdashboar-774cd3 s-userdashboar-cc0420" style={{ border: '1px solid var(--ivory)' }}>
        <div className="s-userdashboar-8a0c3f" />
        <div className="s-userdashboar-f3adca" />

        <div className="s-userdashboar-05d900">
          <ProfileAvatar name={userName || 'U'} size={90} />
          <div className="s-userdashboar-6d7d28">
            <p className="s-userdashboar-3d0c32 twam-font-body">Welcome back,</p>
            <h2 className="s-userdashboar-75e420 twam-font-heading twam-brand">{userName || 'Guest'}</h2>
            {email && <p className="s-userdashboar-bc8be4">{email}</p>}
            {phone && <p className="s-userdashboar-a9730b">{phone}</p>}
          </div>
          <button
            onClick={() => navigate('/account/update-profile')}
            className="s-userdashboar-7b7942 twam-font-body"
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--brand)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--brand)'; e.currentTarget.style.transform = 'none'; }}
          >
            <i className="bi bi-pencil" /> Edit Profile
          </button>
        </div>

        {/* Profile Completion */}
        {profilePct < 100 && (
          <div className="s-userdashboar-d5b805 s-userdashboar-cc0420" style={{ border: '1px solid var(--ivory)' }}>
            <div className="s-userdashboar-474527">
              <span className="s-userdashboar-fcb8d4">Profile Completion</span>
              <span className="s-userdashboar-1af3de">{profilePct}%</span>
            </div>
            <div className="s-userdashboar-4d1c1f">
              <div className="s-userdashboar-5d16ab" style={ {width: `${profilePct}%`} } />
            </div>
          </div>
        )}
      </div>

      {/* ── Stats Grid ── */}
      <div className="stats-grid fade-in s-userdashboar-87744d">
        <StatCard icon="bi-bag-check-fill" label="Total Orders" value={totalOrders || 0} onClick={() => setActiveTab('orders')} />
        <StatCard icon="bi-heart-fill" label="Wishlist Items" value={wishlistItems.length} onClick={() => setActiveTab('wishlist')} />
        <StatCard icon="bi-ticket-perforated-fill" label="Active Coupons" value={activeCoupons.length} onClick={() => navigate('/account/coupons-list')} />
        <StatCard icon="bi-geo-alt-fill" label="Saved Addresses" value={(Array.isArray(addresses) ? addresses : []).length} onClick={() => navigate('/account/address-list')} />
      </div>

      {/* ── Tab Navigation ── */}
      <div className="dash-tab-bar s-userdashboar-2001f8 s-userdashboar-cc0420" style={{ border: '1px solid var(--ivory)' }}>
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className="s-userdashboar-ff7df3" style={ {fontWeight: activeTab === tab.key ? 700 : 500, fontFamily: SANS, background: activeTab === tab.key ? 'var(--brand)' : 'transparent', color: activeTab === tab.key ? '#fff' : 'var(--heirloom)'} }>
            <i className={`bi ${tab.icon} s-userdashboar-c14ee8`} />
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
          <div className="s-userdashboar-a66e26 s-userdashboar-cc0420" style={{ border: '1px solid var(--ivory)' }}>
            <div className="s-userdashboar-7227e4 s-userdashboar-4cf32e" style={{ borderBottom: '1px solid var(--ivory)' }}>
              <h3 className="s-userdashboar-87c84b twam-font-heading twam-brand">
                <i className="bi bi-grid-3x3-gap-fill s-userdashboar-060ee3" />Quick Actions
              </h3>
            </div>
            <div className="dash-actions-grid s-userdashboar-ca4db4">
              {[
                { icon: 'bi-person-fill', label: 'My Profile', to: '/account/update-profile' },
                { icon: 'bi-geo-alt-fill', label: 'Addresses', to: '/account/address-list' },
                { icon: 'bi-ticket-perforated-fill', label: 'Coupons', to: '/account/coupons-list' },
                { icon: 'bi-bell-fill', label: 'Notifications', to: '/account/notifications' },
                { icon: 'bi-question-circle-fill', label: 'Help Center', to: '/help-center' },
                { icon: 'bi-lock-fill', label: 'Change Password', to: '/account/change-password' },
              ].map(link => (
                <div key={link.to} onClick={() => navigate(link.to)} className="s-userdashboar-b88f4a"
                  onMouseEnter={e => { e.currentTarget.style.background = `var(--brand)10`; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--ivory)'; e.currentTarget.style.transform = 'none'; }}
                >
                  <div className="s-userdashboar-dd4bc7">
                    <i className={`bi ${link.icon} s-userdashboar-0901fb`} />
                  </div>
                  <span className="s-userdashboar-4adb1b twam-font-body twam-brand">{link.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Orders Preview */}
          {(Array.isArray(orders) ? orders : []).length > 0 && (
            <div className="s-userdashboar-a66e26 s-userdashboar-cc0420" style={{ border: '1px solid var(--ivory)' }}>
              <div className="s-userdashboar-465608 s-userdashboar-4cf32e" style={{ borderBottom: '1px solid var(--ivory)' }}>
                <h3 className="s-userdashboar-87c84b twam-font-heading twam-brand">
                  <i className="bi bi-bag-check-fill s-userdashboar-060ee3" />Recent Orders
                </h3>
                <button onClick={() => setActiveTab('orders')} className="s-userdashboar-d098ef">
                  View All <i className="bi bi-arrow-right" />
                </button>
              </div>
              {(Array.isArray(orders) ? orders.slice(0, 3) : []).map((order: any) => {
                const status = order.state || order.status || 'Pending';
                const sColor = STATUS_COLORS[status] || { bg: 'var(--ivory)', text: 'var(--heirloom)' };
                const items = order.orderDetails || order.items || [];
                const firstImg = items[0]?.productImage || items[0]?.image;
                return (
                  <div key={order.orderId} className="order-row"
                    onClick={() => navigate(`/order-details/${order.orderId}`)}
                    className="s-userdashboar-e190af s-userdashboar-4cf32e" style={{ borderBottom: '1px solid var(--ivory)' }}>
                    <div className="s-userdashboar-d3398b s-userdashboar-cc0420" style={{ border: '1px solid var(--ivory)' }}>
                      {firstImg ? (
                        <img
                          src={firstImg.startsWith('http') ? firstImg : `${((import.meta as any).env?.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api').replace(/\/api$/, '')}${firstImg}`}
                          alt="" className="s-userdashboar-4ebae2"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div className="s-userdashboar-d44f74">
                          <i className="bi bi-box s-userdashboar-af7acb" />
                        </div>
                      )}
                    </div>
                    <div className="s-userdashboar-7aa8c4">
                      <div className="s-userdashboar-8c79a2">
                        <span className="s-userdashboar-4adb1b twam-brand">Order #{String(order.orderId).slice(-6)}</span>
                        <span className="s-userdashboar-0fae25 s-userdashboar-8cb9f1">{status}</span>
                      </div>
                      <div className="s-userdashboar-44a83f">
                        {items.length} item{items.length !== 1 ? 's' : ''} · ₹{order.subTotal || order.totalAmount || 0}
                      </div>
                    </div>
                    <i className="bi bi-chevron-right s-userdashboar-1b3d64" />
                  </div>
                );
              })}
            </div>
          )}

          {/* Active Coupons Preview */}
          {activeCoupons.length > 0 && (
            <div className="s-userdashboar-7a7de1 s-userdashboar-cc0420" style={{ border: '1px solid var(--ivory)' }}>
              <div className="s-userdashboar-465608 s-userdashboar-4cf32e" style={{ borderBottom: '1px solid var(--ivory)' }}>
                <h3 className="s-userdashboar-87c84b twam-font-heading twam-brand">
                  <i className="bi bi-ticket-perforated-fill s-userdashboar-060ee3" />Active Coupons
                </h3>
                <Link to="/account/coupons-list" className="s-userdashboar-f1b322">
                  View All <i className="bi bi-arrow-right" />
                </Link>
              </div>
              <div className="s-userdashboar-e11d61">
                {activeCoupons.slice(0, 4).map((coupon: any, i: number) => (
                  <div key={i} className="s-userdashboar-2e739f">
                    <div className="s-userdashboar-2a4f1e twam-font-heading">
                      {coupon.couponCode || coupon.code}
                    </div>
                    <div className="s-userdashboar-efb0e1">
                      {coupon.discountType === 'Percentage' ? `${coupon.discountValue}% off` : `₹${coupon.discountValue} off`}
                    </div>
                    {coupon.minOrderValue && (
                      <div className="s-userdashboar-712b45">Min order ₹{coupon.minOrderValue}</div>
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
          <div className="s-userdashboar-e7c84d">
            {ORDER_FILTERS.map(f => (
              <button key={f} onClick={() => { setOrderFilter(f); setOrderPage(1); }} className="s-userdashboar-695b9d" style={ {border: `1.5px solid ${orderFilter === f ? 'var(--brand)' : 'var(--ivory)'}`, background: orderFilter === f ? 'var(--brand)' : '#fff', color: orderFilter === f ? '#fff' : 'var(--heirloom)', fontWeight: orderFilter === f ? 700 : 500, fontFamily: SANS} }>
                {f}
              </button>
            ))}
          </div>

          {/* Orders list */}
          <div className="s-userdashboar-8d23e0 s-userdashboar-cc0420" style={{ border: '1px solid var(--ivory)' }}>
            {(Array.isArray(orders) ? orders : []).length === 0 ? (
              <div className="s-userdashboar-9326e9">
                <i className="bi bi-bag s-userdashboar-d4db73" />
                <p className="s-userdashboar-46bc26">
                  {orderFilter === 'All' ? 'No orders yet' : `No ${orderFilter.toLowerCase()} orders`}
                </p>
                <button onClick={() => navigate('/user-products/product-list')} className="s-userdashboar-28646b twam-font-body">
                  Start Shopping
                </button>
              </div>
            ) : (
              (Array.isArray(orders) ? orders : []).map((order: any) => {
                const status = order.state || order.status || 'Pending';
                const sColor = STATUS_COLORS[status] || { bg: 'var(--ivory)', text: 'var(--heirloom)' };
                const items = order.orderDetails || order.items || [];
                const firstImg = items[0]?.productImage || items[0]?.image;

                return (
                  <div key={order.orderId} className="order-row"
                    onClick={() => navigate(`/order-details/${order.orderId}`)}
                    className="s-userdashboar-0d6b2e s-userdashboar-4cf32e" style={{ borderBottom: '1px solid var(--ivory)' }}>
                    <div className="s-userdashboar-e71c31 s-userdashboar-cc0420" style={{ border: '1px solid var(--ivory)' }}>
                      {firstImg ? (
                        <img
                          src={firstImg.startsWith('http') ? firstImg : `${((import.meta as any).env?.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api').replace(/\/api$/, '')}${firstImg}`}
                          alt="" className="s-userdashboar-4ebae2"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div className="s-userdashboar-d44f74">
                          <i className="bi bi-box s-userdashboar-dcc11e" />
                        </div>
                      )}
                    </div>
                    <div className="s-userdashboar-7aa8c4">
                      <div className="s-userdashboar-8c79a2">
                        <span className="s-userdashboar-2efcea twam-font-body twam-brand">
                          Order #{String(order.orderId).slice(-6)}
                        </span>
                        <span className="s-userdashboar-30766a s-userdashboar-8cb9f1">
                          {status}
                        </span>
                      </div>
                      <div className="s-userdashboar-0df734">
                        {items.length} item{items.length !== 1 ? 's' : ''} · ₹{order.subTotal || order.totalAmount || 0}
                      </div>
                      {order.createdDate && (
                        <div className="s-userdashboar-f42419">
                          {new Date(order.createdDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      )}
                    </div>
                    <i className="bi bi-chevron-right s-userdashboar-dd2c58" />
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
            <div className="s-userdashboar-3c9868 s-userdashboar-cc0420" style={{ border: '1px solid var(--ivory)' }}>
              <div className="s-userdashboar-e898d6">
                <i className="bi bi-heart s-userdashboar-6fa373" />
              </div>
              <h3 className="s-userdashboar-0f293f twam-font-heading">Your wishlist is empty</h3>
              <p className="s-userdashboar-c65daf">
                Save items you love by clicking the heart icon on any product.
              </p>
              <button onClick={() => navigate('/user-products/product-list')} className="s-userdashboar-afde5e twam-font-heading">
                <i className="bi bi-arrow-left" /> Browse Products
              </button>
            </div>
          ) : (
            <>
              <div className="s-userdashboar-aee024">
                <p className="s-userdashboar-6f27cc">
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
                }} className="s-userdashboar-b7a17a twam-font-body">
                  <i className="bi bi-trash3" /> Clear all
                </button>
              </div>
              <div className="wl-dash-grid s-userdashboar-03597c">
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
