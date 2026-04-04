// Fixed: field names now match backend CouponResponse schema
// Backend fields: couponCode, couponName, discount (int), startDate, endDate, isExpire
// NOT: code, discountType, discountValue, expiryDate, minOrderAmount, maxDiscountAmount

import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/features/auth/store/authStore';
import { listUserCoupons } from '@/features/orders/api/orders.api';
import Breadcrumb from '@/shared/components/Breadcrumb';

export default function CouponsList() {
  const { getUserId } = useAuthStore();
  const userId = getUserId();

  const { data, isLoading } = useQuery({
    queryKey: ['user-coupons', userId],
    queryFn: () => listUserCoupons({ userProfileId: userId }),
    enabled: !!userId,
    select: (d: any) => d?.list ?? d ?? [],
  });

  const coupons: any[] = data ?? [];
  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => toast.success(`Copied "${code}"!`));
  };

  if (isLoading) return (
    <div className="d-flex justify-content-center py-4"><div className="spinner-border text-secondary" /></div>
  );

  return (
    <>
      <Breadcrumb items={[
        { label: 'Home', path: '/' },
        { label: 'My Account', path: '/account/update-profile' },
        { label: 'Coupons' }
      ]} />
      <div>
      <h5 className="mb-4">My Coupons</h5>

      {coupons.length === 0 ? (
        <div className="text-center py-5">
          <i className="bi bi-ticket-perforated s-addresslist-d71ded" />
          <p className="text-muted mt-3">No coupons available right now.</p>
        </div>
      ) : (
        <div className="row g-3">
          {coupons.map((coupon: any) => {
            // FIX: backend uses endDate not expiryDate; isExpire is a computed field
            const isExpired = coupon.isExpire === true ||
              (coupon.endDate && new Date(coupon.endDate) < new Date());

            return (
              <div key={coupon.couponId} className="col-md-6">
                <div
                  className={`h-100 ${isExpired ? 'opacity-50' : ''} s-couponslist-f13c87`}
                >
                  <div className="d-flex justify-content-between align-items-start">
                    <div className="flex-fill">
                      {/* FIX: backend field is couponCode not code */}
                      <span
                        className="badge mb-2 s-couponslist-d339e9"
                      >
                        {coupon.couponCode ?? '—'}
                      </span>

                      {/* FIX: backend field is couponName not title */}
                      {coupon.couponName && (
                        <p className="mb-1 fw-semibold s-addresslist-92985e">{coupon.couponName}</p>
                      )}

                      {/* FIX: backend field is discount (flat number) not discountValue/discountType */}
                      <p className="mb-1 s-addresslist-92985e">
                        {coupon.discount != null ? `${coupon.discount}% off` : 'Special Discount'}
                      </p>

                      {coupon.description && (
                        <p className="text-muted mb-0 s-couponslist-030edf">{coupon.description}</p>
                      )}
                    </div>

                    <button
                      className="btn btn-sm btn-outline-dark ms-3 s-addresslist-f8b697"
                      onClick={() => copyCode(coupon.couponCode)}
                      disabled={isExpired || !coupon.couponCode}
                    >
                      <i className="bi bi-copy me-1" />Copy
                    </button>
                  </div>

                  <div className="d-flex justify-content-between align-items-center mt-3 pt-2 border-top">
                    <span className="s-couponslist-030edf">
                      {isExpired ? (
                        <span className="text-danger"><i className="bi bi-x-circle me-1" />Expired</span>
                      ) : (
                        <span className="text-success"><i className="bi bi-check-circle me-1" />Valid</span>
                      )}
                    </span>
                    {/* FIX: backend field is endDate not expiryDate */}
                    {coupon.endDate && (
                      <span className="text-muted s-couponslist-030edf">
                        Expires: {formatDate(coupon.endDate)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
    </>
  );
}
