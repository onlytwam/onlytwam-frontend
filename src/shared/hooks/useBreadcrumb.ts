/**
 * useBreadcrumb
 * 
 * Builds breadcrumbs from the category tree (like Amazon/Flipkart) — NOT from browser history.
 * Always shows the content hierarchy: Home > Parent Category > Subcategory > Page
 *
 * Usage:
 *   const crumbs = useBreadcrumb({ catId: 12 });
 *   const crumbs = useBreadcrumb({ staticItems: [{ label: 'Cart' }] });
 */

import { useMemo } from 'react';
import { useMenuStore } from '@/shared/store/menuStore';
import type { CategoryMenu } from '@/shared/types';

interface Crumb { label: string; path?: string; }

interface Options {
  /** Category ID — auto-builds hierarchy from menu tree */
  catId?: number;
  /** Override the final label (e.g. product name on product detail) */
  currentLabel?: string;
  /** For non-category pages: pass static crumbs after Home */
  staticItems?: Crumb[];
  /** Search query string */
  searchQuery?: string;
}

/** Walk the menu tree and return the path from root to the node with targetId */
function findCategoryPath(menus: CategoryMenu[], targetId: number): CategoryMenu[] {
  for (const menu of menus) {
    if (menu.categoryId === targetId) return [menu];
    if (menu.children?.length) {
      const sub = findCategoryPath(menu.children, targetId);
      if (sub.length) return [menu, ...sub];
    }
  }
  return [];
}

export function useBreadcrumb(options: Options): Crumb[] {
  const { menus } = useMenuStore();
  const { catId, currentLabel, staticItems, searchQuery } = options;

  return useMemo(() => {
    const crumbs: Crumb[] = [{ label: 'Home', path: '/' }];

    // ── Search page
    if (searchQuery) {
      crumbs.push({ label: `Results for "${searchQuery}"` });
      return crumbs;
    }

    // ── Static items (Cart, Wishlist, Orders, etc.)
    if (staticItems?.length) {
      return [...crumbs, ...staticItems];
    }

    // ── Category-based: walk the tree
    if (catId && catId > 0 && menus.length > 0) {
      const path = findCategoryPath(menus, catId);

      path.forEach((cat, i) => {
        const isLast = i === path.length - 1;
        crumbs.push({
          label: cat.name,
          path: isLast && !currentLabel
            ? undefined
            : `/user-products/product-list/${cat.categoryId}`,
        });
      });

      // Optional override for current page label (product name, etc.)
      if (currentLabel) {
        crumbs.push({ label: currentLabel });
      }

      return crumbs;
    }

    // ── All Products (no catId)
    if (!catId || catId === 0) {
      crumbs.push({ label: 'All Products' });
    }

    return crumbs;
  }, [menus, catId, currentLabel, staticItems, searchQuery]);
}