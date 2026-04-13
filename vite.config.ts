import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import dns from "node:dns";

// Kích hoạt nhận diện IPv4 ưu tiên để chống lỗi ERR_CONNECTION_REFUSED
// trên các hệ thống Windows chạy song song Spring Boot & Vite.
dns.setDefaultResultOrder('ipv4first');

export default defineConfig({
  // Fix cho sockjs-client yêu cầu biến "global"
  define: {
    global: "window",
  },
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },

  // Dev server proxy — forwards /api calls to the backend, avoiding CORS
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      // Proxy cho WebSocket (SockJS)
      "/api/v1/ws": {
        target: "http://localhost:8080",
        ws: true,
        changeOrigin: true,
      },
    },
  },


  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ["**/*.svg", "**/*.csv"],
});

