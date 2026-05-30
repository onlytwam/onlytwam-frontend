/**
 * features/orders/hooks/useOrders.ts
 * ────────────────────────────────────
 * TanStack Query hooks for orders, cart, and address data.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listOrders,
  getOrderDetail,
  createOrder,
  listAddress,
  cancelOrder,
  getOrderTracking,
} from "../api/orders.api";
import type { OrderModel } from "@/shared/types";

// ── Query key factory ─────────────────────────────────────────────────────────
export const orderKeys = {
  all: () => ["orders"] as const,
  list: (params: any) => [...orderKeys.all(), "list", params] as const,
  detail: (id: number) => [...orderKeys.all(), "detail", id] as const,
  tracking: (id: number) => [...orderKeys.all(), "tracking", id] as const,
  addresses: (uid: string) => ["addresses", uid] as const,
};

// ── Order list ────────────────────────────────────────────────────────────────
export function useOrders(
  params: {
    userProfileId?: string;
    status?: string;
    pageNumber?: number;
    pageSize?: number;
  },
  enabled = true,
) {
  return useQuery({
    queryKey: orderKeys.list(params),
    queryFn: () => listOrders(params),
    enabled: enabled && !!params.userProfileId,
    staleTime: 2 * 60 * 1000,
  });
}

// ── Single order detail ───────────────────────────────────────────────────────
export function useOrderDetail(id: number, enabled = true) {
  return useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: () => getOrderDetail(id),
    enabled: enabled && id > 0,
    staleTime: 2 * 60 * 1000,
  });
}

// ── Order tracking ────────────────────────────────────────────────────────────
export function useOrderTracking(id: number, enabled = true) {
  return useQuery({
    queryKey: orderKeys.tracking(id),
    queryFn: () => getOrderTracking(id),
    enabled: enabled && id > 0,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

// ── Create order ──────────────────────────────────────────────────────────────
export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: OrderModel) => createOrder(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.all() });
    },
  });
}

// ── Cancel order ──────────────────────────────────────────────────────────────
export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      orderId: number;
      isRefund: boolean;
      reason: string;
      platform?: string;
    }) => cancelOrder(data),
    onSuccess: (_data: any, variables: any) => {
      qc.invalidateQueries({ queryKey: orderKeys.detail(variables.orderId) });
      qc.invalidateQueries({ queryKey: orderKeys.all() });
    },
  });
}

// ── Address list ──────────────────────────────────────────────────────────────
export function useAddresses(userProfileId: string, enabled = true) {
  return useQuery({
    queryKey: orderKeys.addresses(userProfileId),
    queryFn: () => listAddress({ userProfileId }),
    enabled: enabled && !!userProfileId,
    staleTime: 5 * 60 * 1000,
  });
}
