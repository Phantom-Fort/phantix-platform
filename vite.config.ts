import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

/**
 * Platform dev server.
 *
 *   API_PROXY_TARGET   default https://staging.phantix.site
 *   DEV_PORT           default 5174
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.API_PROXY_TARGET || process.env.API_PROXY_TARGET || "https://staging.phantix.site";
  const port = Number(env.DEV_PORT || process.env.DEV_PORT || 5174);
  const localPublic = path.resolve(__dirname, "public");
  const monorepoPublic = path.resolve(__dirname, "../public");

  return {
    plugins: [react()],
    publicDir: fs.existsSync(localPublic) ? localPublic : monorepoPublic,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port,
      host: true,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          secure: true,
          ws: true,
        },
      },
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
  };
});
