import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";

// GitHub Pages project site is served under /<repo>/.
// Override with VITE_BASE (e.g. "/" for a custom domain or user page).
const base = process.env.VITE_BASE ?? "/budget/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "favicon-96x96.png", "apple-touch-icon.png"],
      manifest: {
        id: base,
        name: "Budget — postes de dépenses",
        short_name: "Budget",
        description: "Suivi des postes de dépenses mensuels avec report du solde d'un mois sur l'autre.",
        lang: "fr",
        theme_color: "#2563eb",
        background_color: "#f1f5f9",
        display: "standalone",
        orientation: "portrait",
        start_url: base,
        scope: base,
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    globals: true,
    environment: "jsdom",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
});
