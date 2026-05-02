import { create } from 'zustand';
import type { CategoryMenu } from '@/shared/types';

interface MenuState {
  menus: CategoryMenu[];
  setMenus: (menus: CategoryMenu[]) => void;
  loadMenusFromSession: () => void;
  loadAdminMenusFromSession: () => void;
}

export const useMenuStore = create<MenuState>((set) => ({
  menus: [],

  setMenus: (menus) => set({ menus }),

  loadMenusFromSession: () => {
    const menus = JSON.parse(sessionStorage.getItem('menus') || '[]');
    set({ menus });
  },

  loadAdminMenusFromSession: () => {
    const menus = JSON.parse(sessionStorage.getItem('adminmenus') || '[]');
    set({ menus });
  },
}));