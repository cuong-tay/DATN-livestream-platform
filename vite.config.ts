import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import dns from "node:dns";

import { cloudflare } from "@cloudflare/vite-plugin";

// Ưu tiên IPv4 cho dev server trên Windows.
dns.setDefaultResultOrder("ipv4first");

export default defineConfig({
  define: {
    global: "globalThis",
  },

  plugins: [react(), tailwindcss(), cloudflare()],

  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
    },
  },

  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },

  server: {
    headers: {
      "Permissions-Policy": "unload=(self)",
    },
  },

  assetsInclude: ["**/*.svg", "**/*.csv"],
});