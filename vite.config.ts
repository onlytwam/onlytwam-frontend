import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Force a single copy of every state/routing lib across ALL chunks.
    // Critical for Vite 8 + Rolldown: without this, lazy-loaded chunks
    // can each resolve their own copy → "X is not a function" at runtime.
    dedupe: [
      "react",
      "react-dom",
      "react-is",
      "scheduler",
      "react-router-dom",
      "react-router",
      "@tanstack/react-query",
      "@tanstack/query-core",
      "zustand",
      "react-hot-toast",
    ],
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        secure: false,
      },
      "/connect": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        secure: false,
      },
      "/uploads": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    // Raise the chunk-size warning threshold (Three.js / recharts are large)
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Group shared vendor libs into named chunks that load BEFORE app code.
        // Each group is its own file → browser can cache them across deploys.
        manualChunks(id: string) {
          // 1. React core — must be first so all other chunks share one copy
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/scheduler/")
          ) {
            return "vendor-react";
          }
          // 2. Zustand — state management used by authStore, menuStore, etc.
          //    Isolated so every lazy chunk imports the same singleton store
          if (id.includes("node_modules/zustand")) {
            return "vendor-zustand";
          }
          // 3. React Query
          if (
            id.includes("node_modules/@tanstack/react-query") ||
            id.includes("node_modules/@tanstack/query-core")
          ) {
            return "vendor-query";
          }
          // 4. React Router
          if (
            id.includes("node_modules/react-router-dom") ||
            id.includes("node_modules/react-router/")
          ) {
            return "vendor-router";
          }
          // 5. Three.js (large — keep separate so it doesn't bloat main chunk)
          if (
            id.includes("node_modules/three") ||
            id.includes("node_modules/@react-three/")
          ) {
            return "vendor-three";
          }
          // 6. Recharts + D3
          if (
            id.includes("node_modules/recharts") ||
            id.includes("node_modules/d3-")
          ) {
            return "vendor-charts";
          }
        },
      },
    },
  },
});
