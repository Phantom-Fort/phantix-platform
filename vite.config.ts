import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

const localPublic = path.resolve(__dirname, "public");
const monorepoPublic = path.resolve(__dirname, "../public");

export default defineConfig({
  plugins: [react()],
  // Prefer local public/ for Vercel (app root); fall back to monorepo ../public
  publicDir: fs.existsSync(localPublic) ? localPublic : monorepoPublic,
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5174,
    host: true,
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          motion: ["framer-motion"],
        },
      },
    },
  },
});
