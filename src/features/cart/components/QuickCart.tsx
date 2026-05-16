import { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/store/authStore";
import {
  listCart,
  deleteCartItem,
  updateCart,
} from "@/features/cart/api/cart.api";
import { getImageUrl } from "@/shared/utils/helpers";
import { resolveHex } from "@/shared/utils/colorHelpers";
import { useOverlayBackDismiss } from "@/shared/hooks/useOverlayBackDismiss";
import toast from "react-hot-toast";

/** Merge duplicate cart rows that share the same productVariantDetailId */
function mergeCartDuplicates(rawItems: any[]): any[] {
  const seen = new Map<string, any>();
  const order: string[] = [];
  for (const item of rawItems) {
    // Use productVariantDetailId as the unique key; fall back to cartId so nothing is lost
    const key =
      item.productVariantDetailId != null
        ? String(item.productVariantDetailId)
        : `cart-${item.cartId}`;
    if (seen.has(key)) {
      // Accumulate quantity onto the first occurrence; keep the lowest cartId
      const existing = seen.get(key)!;
      const addedQty =
        Number(item.processedQuantity) || Number(item.quantity) || 1;
      existing.processedQuantity = (existing.processedQuantity || 1) + addedQty;
      existing.quantity = existing.processedQuantity;
      // Collect extra cartIds so we can delete them after the user changes qty/removes
      existing._extraCartIds = [...(existing._extraCartIds ?? []), item.cartId];
    } else {
      seen.set(key, {
        ...item,
        processedQuantity:
          Number(item.processedQuantity) || Number(item.quantity) || 1,
      });
      order.push(key);
    }
  }
  return order.map((k) => seen.get(k)!);
}

interface Props {
  onClose: () => void;
}

export default function QuickCart({ onClose }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const prevPath = location.pathname + location.search;
  const qc = useQueryClient();
  const { hasValidToken, getUserId, setCartCount, cartCount } = useAuthStore();
  const { dismiss, dismissThen } = useOverlayBackDismiss(onClose);
  const panelRef = useRef<HTMLDivElement>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === "Escape" && dismiss();
    document.addEventListener("keydown", fn);
    const handlePointerDown = (event: PointerEvent) => {
      const panel = panelRef.current;
      if (!panel) return;
      const target = event.target as Element | null;
      if (target?.closest?.('[data-quickcart-trigger="true"]')) return;
      if (target && !panel.contains(target)) {
        event.preventDefault();
        event.stopPropagation();
        dismiss();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", fn);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.body.style.overflow = prev;
    };
  }, [dismiss]);

  const { data: cartData, isLoading } = useQuery({
    queryKey: ["quick-cart", getUserId()],
    queryFn: () => listCart({ userProfileId: getUserId() }),
    enabled: hasValidToken(),
    // Override global refetchOnMount:false — the panel is opened/closed repeatedly
    // and must always show the latest cart contents (items added from other pages
    // mark the cache stale but don't refetch while the panel is closed).
    refetchOnMount: true,
  });

  const [guestItems, setGuestItemsState] = useState<any[]>(() => {
    if (hasValidToken()) return [];
    try {
      return JSON.parse(localStorage.getItem("guestCart") || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (hasValidToken()) return;
    const sync = () => {
      try {
        setGuestItemsState(
          JSON.parse(localStorage.getItem("guestCart") || "[]"),
        );
      } catch {}
    };
    window.addEventListener("guestCartUpdated", sync);
    return () => window.removeEventListener("guestCartUpdated", sync);
  }, []);

  const rawItems = hasValidToken()
    ? cartData?.list ?? cartData ?? []
    : guestItems;
  // Merge any duplicate rows (same productVariantDetailId) that may already exist in DB
  const items = useMemo(() => mergeCartDuplicates(rawItems), [rawItems]);
  const total = items.reduce(
    (s: number, i: any) =>
      s +
      (i.finalPrice || i.price || 0) * (i.quantity || i.processedQuantity || 1),
    0,
  );

  // ── Remove mutation ────────────────────────────────────────────────────────
  const removeMut = useMutation({
    mutationFn: (cartId: number) => deleteCartItem(cartId),
    onSuccess: () => {
      toast.success("Removed");
      setCartCount(Math.max(0, (cartCount || 1) - 1));
      qc.invalidateQueries({ queryKey: ["quick-cart"] });
      qc.invalidateQueries({ queryKey: ["cart"] });
      qc.invalidateQueries({ queryKey: ["cart-bootstrap"] });
    },
    onError: () => toast.error("Failed to remove item"),
  });

  // ── Update mutation — FIX: send cartId in body as CartUpdate schema requires it ──
  const updateMut = useMutation({
    mutationFn: ({ id, qty }: { id: number; qty: number }) =>
      updateCart(id, { cartId: id, quantity: qty }), // ← cartId required in body
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quick-cart"] });
      qc.invalidateQueries({ queryKey: ["cart"] });
    },
    onError: () => toast.error("Failed to update quantity"),
  });

  const removeMergedItem = async (item: any) => {
    const ids = Array.from(
      new Set(
        [item.cartId, ...(item._extraCartIds ?? [])].filter(
          (id): id is number => typeof id === "number" && Number.isFinite(id),
        ),
      ),
    );

    if (ids.length <= 1) {
      removeMut.mutate(item.cartId);
      return;
    }

    try {
      await Promise.all(ids.map((id) => deleteCartItem(id)));
      toast.success("Removed");
      setCartCount(Math.max(0, (cartCount || 1) - 1));
      qc.invalidateQueries({ queryKey: ["quick-cart"] });
      qc.invalidateQueries({ queryKey: ["cart"] });
      qc.invalidateQueries({ queryKey: ["cart-bootstrap"] });
    } catch {
      toast.error("Failed to remove item");
    }
  };

  // ── Guest helpers ──────────────────────────────────────────────────────────
  const removeGuest = (pvdId: number) => {
    const updated = guestItems.filter(
      (i: any) => i.productVariantDetailId !== pvdId,
    );
    localStorage.setItem("guestCart", JSON.stringify(updated));
    window.dispatchEvent(new Event("guestCartUpdated"));
    toast.success("Removed");
  };

  const changeGuestQty = (pvdId: number, qty: number) => {
    if (qty < 1) return;
    const updated = guestItems.map((i: any) =>
      i.productVariantDetailId === pvdId
        ? { ...i, quantity: qty, processedQuantity: qty }
        : i,
    );
    localStorage.setItem("guestCart", JSON.stringify(updated));
    window.dispatchEvent(new Event("guestCartUpdated"));
  };

  // ── Increase qty with stock check ─────────────────────────────────────────
  const handleIncrease = (item: any) => {
    const qty = item.processedQuantity || item.quantity || 1;
    const maxStock = item.stockQuantity ?? null; // stockQuantity comes from API for logged-in users

    if (maxStock !== null && qty >= maxStock) {
      toast.error(
        maxStock === 0
          ? "This item is out of stock"
          : `Only ${maxStock} unit${
              maxStock !== 1 ? "s" : ""
            } available in stock`,
        { icon: "⚠️" },
      );
      return;
    }

    if (hasValidToken()) {
      const extraIds: number[] = item._extraCartIds ?? [];
      if (extraIds.length > 0) {
        // This item was merged from multiple DB rows. Consolidate first:
        // delete the extra duplicate rows, then set the primary row to the
        // new total. Without this, each extra row's quantity is added back
        // on the next refetch and the count jumps incorrectly.
        Promise.all(extraIds.map((id) => deleteCartItem(id)))
          .then(() => updateMut.mutate({ id: item.cartId, qty: qty + 1 }))
          .catch(() => toast.error("Failed to update quantity"));
      } else {
        updateMut.mutate({ id: item.cartId, qty: qty + 1 });
      }
    } else {
      changeGuestQty(item.productVariantDetailId, qty + 1);
    }
  };

  // ── Decrease qty (removes item when qty reaches 0) ─────────────────────────
  const handleDecrease = (item: any) => {
    const qty = item.processedQuantity || item.quantity || 1;
    const extraIds: number[] = item._extraCartIds ?? [];

    if (hasValidToken()) {
      if (extraIds.length > 0) {
        // Merged item — consolidate duplicate rows before updating.
        const newQty = qty - 1;
        if (newQty < 1) {
          void removeMergedItem(item);
        } else {
          // Delete extra duplicate rows, then update primary to the new total
          Promise.all(extraIds.map((id) => deleteCartItem(id)))
            .then(() => updateMut.mutate({ id: item.cartId, qty: newQty }))
            .catch(() => toast.error("Failed to update quantity"));
        }
      } else if (qty <= 1) {
        removeMut.mutate(item.cartId);
      } else {
        updateMut.mutate({ id: item.cartId, qty: qty - 1 });
      }
    } else {
      if (qty <= 1) removeGuest(item.productVariantDetailId);
      else changeGuestQty(item.productVariantDetailId, qty - 1);
    }
  };

  const handlePanelTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (!touch) return;
    swipeStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
    };
  };

  const handlePanelTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const start = swipeStartRef.current;
    const touch = e.changedTouches[0];
    swipeStartRef.current = null;
    if (!start || !touch) return;

    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;

    // Swipe right to close the right-side drawer.
    if (dx > 60 && Math.abs(dx) > Math.abs(dy) * 1.1) {
      dismiss();
    }
  };

  return (
    <>
      <div className="s-quickcart-75c969" onClick={dismiss} />

      <div
        className="s-quickcart-f483a8"
        ref={panelRef}
        onDoubleClick={dismiss}
        onTouchStart={handlePanelTouchStart}
        onTouchEnd={handlePanelTouchEnd}
        onTouchCancel={() => {
          swipeStartRef.current = null;
        }}
      >
        {/* ── Header ── */}
        <div className="s-quickcart-f272f0">
          <div className="s-adminbar-877368">
            <i className="bi bi-cart3 s-quickcart-efcb48" />
            <h3 className="s-quickcart-fdb448">My Cart</h3>
            {items.length > 0 && (
              <span className="s-quickcart-ea3ac8">{items.length}</span>
            )}
          </div>
          <button onClick={dismiss} className="s-adminsupport-40536d">
            ×
          </button>
        </div>

        {/* ── Items list ── */}
        <div className="s-quickcart-1b9d23">
          {isLoading ? (
            <div className="s-quickcart-9164c7">
              <div className="s-quickcart-bc6b8b" />
            </div>
          ) : items.length === 0 ? (
            <div className="s-quickcart-1a1604">
              <i className="bi bi-cart-x s-quickcart-78b615" />
              <h4 className="s-quickcart-14d4fb">Your cart is empty</h4>
              <p className="s-addresslist-92985e">Add items to get started</p>
              <button
                onClick={() => dismissThen(() => navigate(prevPath))}
                className="s-quickcart-552d28"
              >
                Continue Shopping
              </button>
            </div>
          ) : (
            items.map((item: any, idx: number) => {
              const qty = item.processedQuantity || item.quantity || 1;
              const price = item.finalPrice || item.price || 0;
              const mrp = item.mrpPrice || item.oldPrice || 0;
              const rawImg =
                item.imageURL || item.image || item.selectedImage || "";
              const img = getImageUrl(rawImg);
              const name = item.productName || item.name || "";
              const colorHex = resolveHex(
                item.colorHex ?? item.color ?? item.Color,
              );
              const colorLabel =
                item.colorName ?? item.color ?? item.Color ?? "";
              const bandSize = item.size || item.bandSize || "";
              const cupSize = item.cupSize || "";
              const maxStock = item.stockQuantity ?? null;
              const atMax = maxStock !== null && qty >= maxStock;

              return (
                <div key={item.cartId || idx} className="s-quickcart-49bd81">
                  {/* Image */}
                  <div
                    className="s-quickcart-2c6bd4"
                    onClick={() =>
                      dismissThen(() =>
                        navigate(
                          `/user-products/product-detail/${item.productVariantId}/product`,
                        ),
                      )
                    }
                  >
                    <img
                      src={img}
                      alt={name}
                      className="s-quickcart-2b92d4"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "/assets/category-bg.png";
                      }}
                    />
                  </div>

                  {/* Details */}
                  <div className="s-userdashboar-7aa8c4">
                    {/* Name */}
                    <h5
                      className="s-quickcart-e5f653"
                      onClick={() =>
                        dismissThen(() =>
                          navigate(
                            `/user-products/product-detail/${item.productVariantId}/product`,
                          ),
                        )
                      }
                    >
                      {name}
                      {item.brandName || item.brand ? (
                        <span className="s-quickcart-a94e44">
                          ({item.brandName || item.brand})
                        </span>
                      ) : null}
                    </h5>

                    {/* Unavailable badge OR normal color/size/price/qty */}
                    {item.categoryIsActive === false ? (
                      <>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            background: "rgba(220,53,69,0.10)",
                            color: "#b91c1c",
                            border: "1.5px solid rgba(185,28,28,0.28)",
                            borderRadius: 5,
                            padding: "4px 10px",
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: 0.8,
                            textTransform: "uppercase",
                            marginBottom: 6,
                          }}
                        >
                          <i
                            className="bi bi-exclamation-circle-fill"
                            style={{ fontSize: 12 }}
                          />
                          Unavailable
                        </span>
                        {/* Delete only — no qty/price controls */}
                        <div
                          className="s-quickcart-addeec"
                          style={{ justifyContent: "flex-end" }}
                        >
                          <button
                            onClick={() => {
                              if (hasValidToken()) void removeMergedItem(item);
                              else removeGuest(item.productVariantDetailId);
                            }}
                            disabled={removeMut.isPending}
                            className="s-quickcart-424294"
                            style={{ opacity: removeMut.isPending ? 0.5 : 1 }}
                          >
                            <i className="bi bi-trash3 s-addresslist-92985e" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Color + Band/Cup size */}
                        {(colorLabel || bandSize || cupSize) && (
                          <div className="s-quickcart-0419ed">
                            {colorLabel && (
                              <span className="s-quickcart-b02946">
                                <span className="s-adminsizes-b54cfc">
                                  Color:
                                </span>
                                <span
                                  className="s-quickcart-b68aaf"
                                  style={{ background: colorHex }}
                                />
                                <span>{colorLabel}</span>
                              </span>
                            )}
                            {bandSize && (
                              <span className="s-adminnewslet-f01220">
                                <span className="s-adminsizes-b54cfc">
                                  Band Size:{" "}
                                </span>
                                <strong>{bandSize}</strong>
                              </span>
                            )}
                            {cupSize && (
                              <span className="s-adminnewslet-f01220">
                                <span className="s-adminsizes-b54cfc">
                                  Cup Size:{" "}
                                </span>
                                <strong>{cupSize}</strong>
                              </span>
                            )}
                          </div>
                        )}

                        {/* Stock warning badge */}
                        {maxStock !== null && maxStock <= 3 && maxStock > 0 && (
                          <div className="s-quickcart-382f33">
                            ⚠️ Only {maxStock} left in stock
                          </div>
                        )}

                        {/* Price + Qty + Delete row */}
                        <div className="s-quickcart-addeec">
                          {/* Qty controls */}
                          <div className="s-quickcart-f7ab1b">
                            <button
                              onClick={() => handleDecrease(item)}
                              disabled={
                                removeMut.isPending || updateMut.isPending
                              }
                              className="s-quickcart-456b82"
                              style={{
                                opacity:
                                  removeMut.isPending || updateMut.isPending
                                    ? 0.5
                                    : 1,
                              }}
                            >
                              −
                            </button>
                            <span className="s-quickcart-b8376f">{qty}</span>
                            <button
                              onClick={() => handleIncrease(item)}
                              disabled={updateMut.isPending || atMax}
                              title={
                                atMax
                                  ? `Max stock: ${maxStock}`
                                  : "Increase quantity"
                              }
                              className="s-quickcart-65fdad"
                              style={{
                                cursor: atMax ? "not-allowed" : "pointer",
                                color: atMax ? "var(--ivory)" : "var(--brand)",
                                opacity: updateMut.isPending ? 0.5 : 1,
                              }}
                            >
                              +
                            </button>
                          </div>

                          {/* Price */}
                          <div className="s-quickcart-f66ceb">
                            <div className="s-quickcart-c3a94f">
                              ₹{(price * qty).toLocaleString("en-IN")}
                            </div>
                            {mrp > price && (
                              <div className="s-quickcart-b469ce">
                                ₹{(mrp * qty).toLocaleString("en-IN")}
                              </div>
                            )}
                          </div>

                          {/* Delete */}
                          <button
                            onClick={() => {
                              if (hasValidToken()) void removeMergedItem(item);
                              else removeGuest(item.productVariantDetailId);
                            }}
                            disabled={removeMut.isPending}
                            className="s-quickcart-424294"
                            style={{ opacity: removeMut.isPending ? 0.5 : 1 }}
                          >
                            <i className="bi bi-trash3 s-addresslist-92985e" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Footer ── */}
        {items.length > 0 && (
          <div className="s-quickcart-6b5f6f">
            <div className="s-quickcart-4b986c">
              <span className="s-quickcart-08341f">
                {items.length} item{items.length !== 1 ? "s" : ""} &nbsp;·&nbsp;
                {items.reduce(
                  (s: number, i: any) =>
                    s + (i.processedQuantity || i.quantity || 1),
                  0,
                )}{" "}
                qty total
              </span>
              <span className="s-quickcart-65e3d5">
                ₹{total.toLocaleString("en-IN")}
              </span>
            </div>
            <div className="s-adminblog-b43398">
              <button
                onClick={() =>
                  dismissThen(() =>
                    navigate("/user-products/cart", {
                      state: { from: location.pathname + location.search },
                    }),
                  )
                }
                className="s-quickcart-febadd"
              >
                View Cart & Checkout
              </button>
              <button onClick={dismiss} className="s-quickcart-ec24cf">
                Continue Shopping
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
