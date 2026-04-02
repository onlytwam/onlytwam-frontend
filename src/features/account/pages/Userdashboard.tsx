/**
 * UserDashboard.tsx – Premium Redesigned Dashboard
 * Enhanced UI with elegant typography, refined spacing, and sophisticated color palette
 */

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/store/authStore';
import { listOrders } from '@/features/orders/api/orders.api';
import { listUserCoupons, listAddress } from '@/features/orders/api/orders.api';
import { listWishlist } from '@/features/products/api/products.api';

// Design System Colors
const PRI = '#6B0F2A';        // Burgundy - Primary actions
const HEIRLOOM = '#9E6070';   // Heirloom Rose - Secondary
const BLUSH = '#A84C6B';      // Blush Pink - Accents
const IVORY = '#F5F0E6';      // Warm Ivory - Background
const DARK = '#2D1B20';       // Dark text
const LIGHT_BORDER = '#E8DED1';

// Typography
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

// Profile Avatar Component
function ProfileAvatar({ name, size = 120 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: `linear-gradient(135deg, ${PRI}, ${BLUSH})`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontSize: size * 0.35,
      fontWeight: 700,
      fontFamily: SERIF,
      boxShadow: '0 8px 32px rgba(107, 15, 42, 0.2)',
      border: '4px solid #fff',
      position: 'relative',
    }}>
      {initials || <i className="bi bi-person-fill" />}
      <div style={{
        position: 'absolute',
        bottom: 4,
        right: 4,
        width: 16,
        height: 16,
        background: '#4CAF50',
        borderRadius: '50%',
        border: '3px solid #fff',
      }} />
    </div>
  );
}

// Stat Card Component
interface StatCardProps {
  icon: string;
  label: string;
  value: string | number;
  onClick?: () => void;
}

function StatCard({ icon, label, value, onClick }: StatCardProps) {
  const [hovered, setHovered] = useState(false);
  
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#fff',
        border: `2px solid ${hovered ? PRI : LIGHT_BORDER}`,
        borderRadius: 16,
        padding: '24px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: hovered ? 'translateY(-4px)' : 'none',
        boxShadow: hovered 
          ? '0 12px 40px rgba(107, 15, 42, 0.12)' 
          : '0 2px 8px rgba(0, 0, 0, 0.04)',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}>
        <div style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          background: hovered ? `${PRI}12` : `${IVORY}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s ease',
        }}>
          <i className={`bi ${icon}`} style={{ 
            fontSize: 24, 
            color: hovered ? PRI : HEIRLOOM 
          }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ 
            fontSize: 32, 
            fontWeight: 700, 
            color: PRI,
            fontFamily: SERIF,
            lineHeight: 1,
          }}>
            {value}
          </div>
          <div style={{ 
            fontSize: 13,
            color: '#666',
            marginTop: 6,
            fontFamily: SANS,
            letterSpacing: '0.3px',
          }}>
            {label}
          </div>
        </div>
      </div>
    </div>
  );
}

// Quick Link Component
function QuickLink({ 
  icon, 
  label, 
  to 
}: { 
  icon: string; 
  label: string; 
  to: string;
}) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);
  
  return (
    <div
      onClick={() => navigate(to)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        padding: '24px 16px',
        background: hovered ? `${PRI}08` : '#fff',
        border: `2px solid ${hovered ? PRI : LIGHT_BORDER}`,
        borderRadius: 14,
        cursor: 'pointer',
        transition: 'all 0.25s ease',
        transform: hovered ? 'translateY(-2px)' : 'none',
      }}
    >
      <div style={{
        width: 52,
        height: 52,
        borderRadius: 12,
        background: hovered ? PRI : `${PRI}12`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.25s ease',
      }}>
        <i className={`bi ${icon}`} style={{ 
          fontSize: 22, 
          color: hovered ? '#fff' : PRI 
        }} />
      </div>
      <span style={{ 
        fontSize: 13,
        fontWeight: 600,
        color: hovered ? PRI : '#555',
        fontFamily: SANS,
        textAlign: 'center',
        letterSpacing: '0.2px',
      }}>
        {label}
      </span>
    </div>
  );
}

export default function UserDashboard() {
  const navigate = useNavigate();
  const { user, getUserId, getUserName } = useAuthStore();
  const userId = getUserId();
  const userName = getUserName();

  const { data: ordersData } = useQuery({
    queryKey: ['orders', userId, 'All', 1],
    queryFn: () => listOrders({ userProfileId: userId, pageSize: 5 }),
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
  const totalOrders = ordersData?.totalCount ?? ordersData?.total ?? orders.length;
  const addresses = addressData?.list ?? addressData?.data ?? addressData ?? [];
  const coupons = couponsData?.list ?? couponsData?.data ?? couponsData ?? [];
  const wishlist = wishlistData?.list ?? wishlistData?.data ?? wishlistData ?? [];

  const recentOrders = Array.isArray(orders) ? orders.slice(0, 3) : [];

  const email = (user as any)?.email || (user as any)?.emailId || '';
  const phone = (user as any)?.phoneNumber || (user as any)?.phone || '';

  const activeCoupons = Array.isArray(coupons)
    ? coupons.filter((c: any) => c.state !== 'Expired' && c.state !== 'Used')
    : [];

  const profileComplete = [userName, email, phone].filter(Boolean).length;
  const profilePct = Math.round((profileComplete / 3) * 100);

  return (
    <div style={{ 
      fontFamily: SANS,
      background: IVORY,
      minHeight: '100vh',
      padding: '32px 24px',
    }}>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: none; }
        }
        .fade-in { animation: fadeIn 0.5s ease forwards; }
        .order-row:hover { background: ${PRI}05 !important; }
        @media (max-width: 1024px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .two-col { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 640px) {
          .stats-grid { grid-template-columns: 1fr !important; }
          .quick-grid { grid-template-columns: repeat(3, 1fr) !important; }
        }
      `}</style>

      {/* Page Header */}
      <div className="fade-in" style={{
        marginBottom: 32,
      }}>
        <h1 style={{
          fontSize: 42,
          fontWeight: 700,
          fontFamily: SERIF,
          color: DARK,
          margin: '0 0 8px 0',
          letterSpacing: '-0.5px',
        }}>
          Your Profile
        </h1>
        <p style={{
          fontSize: 15,
          color: '#666',
          margin: 0,
          fontFamily: SANS,
        }}>
          Welcome back, {userName || 'Guest'}. Manage your personal archive and preferences.
        </p>
      </div>

      {/* Welcome Card */}
      <div className="fade-in" style={{
        background: '#fff',
        borderRadius: 20,
        padding: '40px',
        marginBottom: 32,
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
        border: `1px solid ${LIGHT_BORDER}`,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative elements */}
        <div style={{
          position: 'absolute',
          top: -40,
          right: -40,
          width: 160,
          height: 160,
          borderRadius: '50%',
          background: `${PRI}06`,
        }} />
        <div style={{
          position: 'absolute',
          bottom: -30,
          right: 80,
          width: 100,
          height: 100,
          borderRadius: '50%',
          background: `${BLUSH}08`,
        }} />

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 32,
          position: 'relative',
          flexWrap: 'wrap',
        }}>
          <ProfileAvatar name={userName || 'U'} size={120} />
          
          <div style={{ flex: 1, minWidth: 280 }}>
            <p style={{
              margin: '0 0 4px 0',
              fontSize: 13,
              color: '#666',
              fontFamily: SANS,
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}>
              Welcome back,
            </p>
            <h2 style={{
              margin: '0 0 8px 0',
              fontSize: 32,
              fontWeight: 700,
              fontFamily: SERIF,
              color: DARK,
            }}>
              {userName || 'Guest'}
            </h2>
            {email && (
              <p style={{
                margin: '0 0 4px 0',
                fontSize: 14,
                color: '#666',
              }}>
                {email}
              </p>
            )}
            {phone && (
              <p style={{
                margin: 0,
                fontSize: 14,
                color: '#666',
              }}>
                {phone}
              </p>
            )}
          </div>

          <button
            onClick={() => navigate('/account/update-profile')}
            style={{
              background: PRI,
              border: 'none',
              color: '#fff',
              padding: '12px 28px',
              borderRadius: 10,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              fontFamily: SANS,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s ease',
              boxShadow: `0 4px 16px ${PRI}40`,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#5A0C23';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = PRI;
              e.currentTarget.style.transform = 'none';
            }}
          >
            <i className="bi bi-pencil" /> Edit Profile
          </button>
        </div>

        {/* Profile Completion */}
        {profilePct < 100 && (
          <div style={{
            marginTop: 32,
            padding: '20px',
            background: `${IVORY}`,
            borderRadius: 12,
            border: `1px solid ${LIGHT_BORDER}`,
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}>
              <span style={{
                fontSize: 13,
                color: '#666',
                fontWeight: 600,
              }}>
                Profile Completion
              </span>
              <span style={{
                fontSize: 13,
                fontWeight: 700,
                color: PRI,
              }}>
                {profilePct}%
              </span>
            </div>
            <div style={{
              height: 8,
              background: '#E0D5C7',
              borderRadius: 99,
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${profilePct}%`,
                background: `linear-gradient(90deg, ${PRI}, ${BLUSH})`,
                borderRadius: 99,
                transition: 'width 0.6s ease',
              }} />
            </div>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div
        className="stats-grid fade-in"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 20,
          marginBottom: 32,
        }}
      >
        <StatCard
          icon="bi-bag-check-fill"
          label="Total Orders"
          value={totalOrders || 0}
          onClick={() => navigate('/account/orders-list')}
        />
        <StatCard
          icon="bi-heart-fill"
          label="Wishlist Items"
          value={wishlist.length}
          onClick={() => navigate('/wishlist')}
        />
        <StatCard
          icon="bi-ticket-perforated-fill"
          label="Active Coupons"
          value={activeCoupons.length}
          onClick={() => navigate('/account/coupons-list')}
        />
        <StatCard
          icon="bi-geo-alt-fill"
          label="Saved Addresses"
          value={addresses.length}
          onClick={() => navigate('/account/address-list')}
        />
      </div>

      {/* Two Column Layout */}
      <div
        className="two-col"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 380px',
          gap: 24,
          marginBottom: 32,
        }}
      >
        {/* Recent Orders */}
        <div
          className="fade-in"
          style={{
            background: '#fff',
            borderRadius: 16,
            border: `1px solid ${LIGHT_BORDER}`,
            overflow: 'hidden',
            boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
          }}
        >
          <div style={{
            padding: '24px 28px',
            borderBottom: `1px solid ${LIGHT_BORDER}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <h3 style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 700,
              fontFamily: SERIF,
              color: DARK,
            }}>
              <i className="bi bi-bag-check-fill" style={{ marginRight: 10, color: PRI }} />
              Past Acquisitions
            </h3>
            <Link
              to="/account/orders-list"
              style={{
                fontSize: 13,
                color: PRI,
                textDecoration: 'none',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              View All <i className="bi bi-arrow-right" />
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <div style={{
              padding: '60px 28px',
              textAlign: 'center',
            }}>
              <i className="bi bi-bag" style={{ fontSize: 56, color: '#ddd' }} />
              <p style={{
                margin: '16px 0 20px',
                color: '#aaa',
                fontSize: 15,
              }}>
                No orders yet
              </p>
              <button
                onClick={() => navigate('/user-products/product-list')}
                style={{
                  background: PRI,
                  color: '#fff',
                  border: 'none',
                  padding: '12px 28px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: SANS,
                }}
              >
                Begin Your Collection
              </button>
            </div>
          ) : (
            <div>
              {recentOrders.map((order: any) => {
                const status = order.state || order.status || 'Pending';
                const sColor = STATUS_COLORS[status] || { bg: '#f5f5f5', text: '#555' };
                const items = order.orderDetails || order.items || [];
                const firstImg = items[0]?.productImage || items[0]?.image;
                
                return (
                  <div
                    key={order.orderId}
                    className="order-row"
                    onClick={() => navigate(`/account/orders-list`)}
                    style={{
                      padding: '20px 28px',
                      borderBottom: `1px solid ${LIGHT_BORDER}`,
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 20,
                    }}
                  >
                    <div style={{
                      width: 72,
                      height: 72,
                      borderRadius: 12,
                      background: IVORY,
                      flexShrink: 0,
                      overflow: 'hidden',
                      border: `1px solid ${LIGHT_BORDER}`,
                    }}>
                      {firstImg ? (
                        <img
                          src={firstImg.startsWith('http') ? firstImg : `http://127.0.0.1:8000${firstImg}`}
                          alt=""
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                          onError={e => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <i className="bi bi-box" style={{ fontSize: 28, color: '#ccc' }} />
                        </div>
                      )}
                    </div>
                    
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 12,
                      }}>
                        <span style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: DARK,
                          fontFamily: SANS,
                        }}>
                          Order #{String(order.orderId).slice(-6)}
                        </span>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '4px 12px',
                          borderRadius: 6,
                          background: sColor.bg,
                          color: sColor.text,
                          flexShrink: 0,
                          letterSpacing: '0.3px',
                        }}>
                          {status}
                        </span>
                      </div>
                      <div style={{
                        fontSize: 13,
                        color: '#888',
                        marginTop: 6,
                      }}>
                        {items.length} item{items.length !== 1 ? 's' : ''} · ₹{order.subTotal || order.totalAmount || 0}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div
          className="fade-in"
          style={{
            background: '#fff',
            borderRadius: 16,
            border: `1px solid ${LIGHT_BORDER}`,
            overflow: 'hidden',
            boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
          }}
        >
          <div style={{
            padding: '24px 28px',
            borderBottom: `1px solid ${LIGHT_BORDER}`,
          }}>
            <h3 style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 700,
              fontFamily: SERIF,
              color: DARK,
            }}>
              <i className="bi bi-grid-3x3-gap-fill" style={{ marginRight: 10, color: PRI }} />
              Quick Actions
            </h3>
          </div>
          <div style={{ padding: '20px' }}>
            <div
              className="quick-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 12,
              }}
            >
              <QuickLink icon="bi-person-fill" label="My Profile" to="/account/update-profile" />
              <QuickLink icon="bi-bag-fill" label="My Orders" to="/account/orders-list" />
              <QuickLink icon="bi-heart-fill" label="Wishlist" to="/wishlist" />
              <QuickLink icon="bi-geo-alt-fill" label="Addresses" to="/account/address-list" />
              <QuickLink icon="bi-ticket-perforated-fill" label="Coupons" to="/account/coupons-list" />
              <QuickLink icon="bi-bell-fill" label="Notifications" to="/account/notifications" />
            </div>
          </div>
        </div>
      </div>

      {/* Wishlist Preview */}
      {wishlist.length > 0 && (
        <div
          className="fade-in"
          style={{
            background: '#fff',
            borderRadius: 16,
            border: `1px solid ${LIGHT_BORDER}`,
            marginBottom: 32,
            overflow: 'hidden',
            boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
          }}
        >
          <div style={{
            padding: '24px 28px',
            borderBottom: `1px solid ${LIGHT_BORDER}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <h3 style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 700,
              fontFamily: SERIF,
              color: DARK,
            }}>
              <i className="bi bi-heart-fill" style={{ marginRight: 10, color: PRI }} />
              Saved Favorites
            </h3>
            <Link
              to="/wishlist"
              style={{
                fontSize: 13,
                color: PRI,
                textDecoration: 'none',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              View All ({wishlist.length}) <i className="bi bi-arrow-right" />
            </Link>
          </div>
          <div style={{
            display: 'flex',
            gap: 16,
            padding: '24px 28px',
            overflowX: 'auto',
          }}>
            {wishlist.slice(0, 6).map((item: any, i: number) => {
              const img = item.productImage || item.image;
              return (
                <div
                  key={i}
                  style={{
                    flexShrink: 0,
                    width: 140,
                    cursor: 'pointer',
                  }}
                  onClick={() =>
                    navigate(
                      `/user-products/product-detail/${item.productVariantId}/${(item.productName || '').toLowerCase().replace(/\s+/g, '-')}`
                    )
                  }
                >
                  <div style={{
                    width: 140,
                    height: 180,
                    borderRadius: 12,
                    background: IVORY,
                    overflow: 'hidden',
                    marginBottom: 12,
                    border: `1px solid ${LIGHT_BORDER}`,
                  }}>
                    {img ? (
                      <img
                        src={img.startsWith('http') ? img : `http://127.0.0.1:8000${img}`}
                        alt={item.productName}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                        onError={e => {
                          (e.target as HTMLImageElement).src = '/assets/category-bg.png';
                        }}
                      />
                    ) : (
                      <div style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <i className="bi bi-image" style={{ fontSize: 36, color: '#ccc' }} />
                      </div>
                    )}
                  </div>
                  <p style={{
                    margin: 0,
                    fontSize: 12,
                    fontWeight: 600,
                    color: DARK,
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    lineHeight: 1.4,
                  }}>
                    {item.productName || item.name}
                  </p>
                  <p style={{
                    margin: '6px 0 0',
                    fontSize: 14,
                    fontWeight: 700,
                    color: PRI,
                  }}>
                    ₹{item.price || item.finalPrice}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Coupons */}
      {activeCoupons.length > 0 && (
        <div
          className="fade-in"
          style={{
            background: '#fff',
            borderRadius: 16,
            border: `1px solid ${LIGHT_BORDER}`,
            overflow: 'hidden',
            boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
          }}
        >
          <div style={{
            padding: '24px 28px',
            borderBottom: `1px solid ${LIGHT_BORDER}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <h3 style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 700,
              fontFamily: SERIF,
              color: DARK,
            }}>
              <i className="bi bi-ticket-perforated-fill" style={{ marginRight: 10, color: PRI }} />
              Active Coupons
            </h3>
            <Link
              to="/account/coupons-list"
              style={{
                fontSize: 13,
                color: PRI,
                textDecoration: 'none',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              View All <i className="bi bi-arrow-right" />
            </Link>
          </div>
          <div style={{
            display: 'flex',
            gap: 16,
            padding: '24px 28px',
            overflowX: 'auto',
          }}>
            {activeCoupons.slice(0, 4).map((coupon: any, i: number) => (
              <div
                key={i}
                style={{
                  flexShrink: 0,
                  minWidth: 220,
                  borderRadius: 14,
                  background: `linear-gradient(135deg, ${PRI}08, ${PRI}15)`,
                  border: `2px dashed ${PRI}40`,
                  padding: '20px',
                }}
              >
                <div style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: PRI,
                  fontFamily: SERIF,
                  marginBottom: 8,
                  letterSpacing: '0.5px',
                }}>
                  {coupon.couponCode || coupon.code}
                </div>
                <div style={{
                  fontSize: 13,
                  color: HEIRLOOM,
                  fontWeight: 600,
                }}>
                  {coupon.discountType === 'Percentage'
                    ? `${coupon.discountValue}% off`
                    : `₹${coupon.discountValue} off`}
                </div>
                {coupon.minOrderValue && (
                  <div style={{
                    fontSize: 11,
                    color: '#999',
                    marginTop: 6,
                  }}>
                    Min order ₹{coupon.minOrderValue}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}