// useAuthStore.ts — redirect to real store
// The original file contained a mock stub with a hardcoded token.
// All code should import from '@/features/auth/store/authStore' instead,
// but this re-export ensures any file that imports from here still works.
export { useAuthStore, WishlistStorage } from './authStore';
