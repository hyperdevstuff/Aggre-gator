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
        "#shared": path.resolve(import.meta.dirname, "../shared"),
      },
    },
    server: {
      // Pinned to match CLIENT_URL in app/.env.local — better-auth's trustedOrigins
      // and the backend CORS config both point at this exact origin. The default
      // is 5180, not Vite's 5173: 5173 collides with every other Vite project on
      // the machine, and a silent hop to 5174 also breaks CORS, which is a much
      // more confusing failure than "port in use".
      port: Number(env.VITE_PORT || 5180),
      // Fail loudly instead of incrementing to the next free port. An
      // auto-incremented port is worse than a hard failure here: the API's
      // CLIENT_URL and better-auth's trustedOrigins both name the exact origin,
      // so the app would come up and then fail every authenticated request.
      strictPort: true,
      proxy: {
        "/api": {
          // 3001 is the API's own default (app/src/env.ts). Defaulting to 3000
          // here meant a checkout without VITE_API_URL silently talked to
          // whatever else was listening on 3000.
          target: env.VITE_API_URL || "http://localhost:3001",
          changeOrigin: true,
        },
      },
    },
  };
});
