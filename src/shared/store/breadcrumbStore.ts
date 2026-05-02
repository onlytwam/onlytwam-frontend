/**
 * breadcrumbStore
 *
 * Lets any page push dynamic crumbs (category tree, product name, etc.)
 * into the single global <AutoBreadcrumb> rendered by App.tsx.
 *
 * Usage in a page:
 *   const { setCrumbs } = useBreadcrumbStore();
 *   useEffect(() => {
 *     setCrumbs([{ label: 'Home', path: '/' }, { label: 'Product Name' }]);
 *   }, [productName]);
 *
 * The store is cleared automatically by AutoBreadcrumb on every route change,
 * so stale crumbs from a previous page never leak through.
 */

import { create } from 'zustand';
import type { Crumb } from '@/shared/components/Breadcrumb';

interface BreadcrumbState {
  crumbs: Crumb[] | null;
  setCrumbs: (crumbs: Crumb[]) => void;
  clearCrumbs: () => void;
}

export const useBreadcrumbStore = create<BreadcrumbState>((set) => ({
  crumbs: null,
  setCrumbs: (crumbs) => set({ crumbs }),
  clearCrumbs: () => set({ crumbs: null }),
}));
