import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

export default defineConfig(({ mode }) => {
  // `loadEnv` (rather than `process.env`) is what actually exposes .env.local
  // values here — Vite does not put them on process.env.
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      tanstackRouter({
        target: "react",
        autoCodeSplitting: true,
      }),
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
      },
    },
    server: {
      // Pinned to match CLIENT_URL in app/.env.local — better-auth's trustedOrigins
      // and the backend CORS config both point at this exact origin.
      port: Number(env.VITE_PORT || 5173),
      strictPort: true,
      proxy: {
        "/api": {
          target: env.VITE_API_URL || "http://localhost:3000",
          changeOrigin: true,
        },
      },
    },
  };
});
