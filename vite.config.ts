import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: [
      "react",
      "react-dom",
      "react-router-dom",
      "@tanstack/react-query",
      "scheduler",
      "react-hot-toast",
      "zustand",
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
    rollupOptions: {
      // Ensures a single copy of React is used across all chunks
      output: {
        manualChunks(id) {
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/")
          ) {
            return "react-vendor";
          }
          if (id.includes("node_modules/@tanstack/react-query")) {
            return "react-query-vendor";
          }
          if (
            id.includes("node_modules/react-router-dom") ||
            id.includes("node_modules/react-router/")
          ) {
            return "router-vendor";
          }
          if (
            id.includes("node_modules/@react-three/") ||
            id.includes("node_modules/three")
          ) {
            return "three-vendor";
          }
        },
      },
    },
  },
});
