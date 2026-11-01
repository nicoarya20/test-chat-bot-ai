import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Same-origin dev setup: the browser talks to Vite, which proxies /api to the server.
const apiTarget = process.env.API_PROXY_TARGET ?? "http://localhost:3000";
const port = Number(process.env.WEB_PORT ?? 5173);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port,
    strictPort: true,
    proxy: { "/api": { target: apiTarget, changeOrigin: false } },
  },
});
