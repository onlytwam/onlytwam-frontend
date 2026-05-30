import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useAuthStore } from "@/features/auth/store/authStore";
import { listUserCoupons } from "@/features/orders/api/orders.api";
import { useIsMobile } from "@/shared/hooks/useIsMobile";

export default function CouponsList() {
  const isMobile = useIsMobile();
  const authStore = useAuthStore();

  // Safely extract userId — handles both function and property patterns
  const userId: string | number | null =
    typeof authStore.getUserId === "function"
      ? authStore.getUserId()
      : (authStore.user as any)?.userProfileId ??
        authStore.user?.userId ??
        authStore.user?.id ??
        null;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["user-coupons", userId],
    // FIX 1: queryFn now only runs when userId is valid (guarded by `enabled`),
    // but also adds a runtime guard to satisfy TypeScript and prevent accidental calls.
    queryFn: () => {
      if (!userId) throw new Error("userId is required");
      return listUserCoupons({ userProfileId: String(userId) });
    },
    enabled: userId !== null && userId !== undefined && userId !== "",
    staleTime: 5 * 60 * 1000,
    select: (d: any) => {
      if (Array.isArray(d)) return d;
      if (d?.list && Array.isArray(d.list)) return d.list;
      return [];
    },
  });

  const coupons: any[] = data ?? [];

  // FIX 2: Gracefully handle invalid/undefined date strings
  const formatDate = (d: string) => {
    if (!d) return "—";
    const parsed = new Date(d);
    if (isNaN(parsed.getTime())) return "—";
    return parsed.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const checkExpired = (coupon: any): boolean =>
    coupon.isExpire === true ||
    (coupon.endDate && new Date(coupon.endDate) < new Date());

  // FIX 3: Added fallback for non-HTTPS / insecure contexts where clipboard API is unavailable
  const copyCode = (code: string) => {
    if (!code) return;

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard
        .writeText(code)
        .then(() => toast.success(`Copied "${code}"!`))
        .catch(() => toast.error("Failed to copy code."));
    } else {
      // Fallback for HTTP or older browsers
      try {
        const textarea = document.createElement("textarea");
        textarea.value = code;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        toast.success(`Copied "${code}"!`);
      } catch {
        toast.error("Failed to copy code.");
      }
    }
  };

  if (!userId) {
    return (
      <div className="text-center py-5">
        <p className="text-muted">Please log in to view your coupons.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          padding: "8px 0",
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            style={{
              borderRadius: 14,
              padding: "18px 20px",
              border: "1.5px dashed var(--ivory)",
              background: "var(--cream, #FAF8F4)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <div
                className="twam-skel"
                style={{ height: 16, width: "35%", borderRadius: 5 }}
              />
              <div
                className="twam-skel"
                style={{ height: 22, width: "20%", borderRadius: 6 }}
              />
            </div>
            <div
              className="twam-skel"
              style={{
                height: 12,
                width: "65%",
                borderRadius: 5,
                marginBottom: 8,
              }}
            />
            <div
              className="twam-skel"
              style={{ height: 11, width: "40%", borderRadius: 5 }}
            />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-5">
        <i className="bi bi-exclamation-circle fs-1 text-danger" />
        <p className="text-danger mt-3">
          Failed to load coupons. Please try again.
        </p>
      </div>
    );
  }

  return (
    <div>
      {!isMobile && <h5 className="mb-4">My Coupons</h5>}

      {coupons.length === 0 ? (
        <div className="text-center py-5">
          {/* FIX 4: Corrected class — was using wrong component prefix "s-addresslist-*" */}
          <i className="bi bi-ticket-perforated s-couponslist-d71ded" />
          <p className="text-muted mt-3">No coupons available right now.</p>
        </div>
      ) : (
        <div className="row g-3">
          {coupons.map((coupon: any) => {
            const isExpired = checkExpired(coupon);

            // FIX 5: Fallback key — couponId may be undefined on malformed data
            const itemKey =
              coupon.couponId ?? coupon.couponCode ?? Math.random();

            return (
              <div key={itemKey} className="col-md-6">
                <div
                  className={`h-100 ${
                    isExpired ? "opacity-50" : ""
                  } s-couponslist-f13c87`}
                >
                  <div className="d-flex justify-content-between align-items-start">
                    <div className="flex-fill">
                      <span className="badge mb-2 s-couponslist-d339e9">
                        {coupon.couponCode ?? "—"}
                      </span>

                      {coupon.couponName && (
                        // FIX 6: Corrected class prefix — was "s-addresslist-92985e"
                        <p className="mb-1 fw-semibold s-couponslist-92985e">
                          {coupon.couponName}
                        </p>
                      )}

                      {/* FIX 7: Corrected class prefix — was "s-addresslist-92985e" */}
                      <p className="mb-1 s-couponslist-92985e">
                        {coupon.discount != null
                          ? `${coupon.discount}% off`
                          : "Special Discount"}
                      </p>

                      {coupon.description && (
                        <p className="text-muted mb-0 s-couponslist-030edf">
                          {coupon.description}
                        </p>
                      )}
                    </div>

                    {/* FIX 8: Corrected class prefix — was "s-addresslist-f8b697" */}
                    <button
                      className="btn btn-sm btn-outline-dark ms-3 s-couponslist-f8b697"
                      onClick={() => copyCode(coupon.couponCode)}
                      disabled={isExpired || !coupon.couponCode}
                    >
                      <i className="bi bi-copy me-1" />
                      Copy
                    </button>
                  </div>

                  <div className="d-flex justify-content-between align-items-center mt-3 pt-2 border-top">
                    <span className="s-couponslist-030edf">
                      {isExpired ? (
                        <span className="text-danger">
                          <i className="bi bi-x-circle me-1" />
                          Expired
                        </span>
                      ) : (
                        <span className="text-success">
                          <i className="bi bi-check-circle me-1" />
                          Valid
                        </span>
                      )}
                    </span>

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
  );
}
