import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";

// GitHub Pages project site is served under /<repo>/.
// Override with VITE_BASE (e.g. "/" for a custom domain or user page).
const base = process.env.VITE_BASE ?? "/budget/";

// The fixture harness (fixture.html) is always served in dev, but is only an
// entry point of the BUILD when VITE_E2E=1 — so it never ships to GitHub Pages.
const e2e = process.env.VITE_E2E === "1";

export default defineConfig({
  base,
  build: e2e
    ? { rollupOptions: { input: { index: "index.html", fixture: "fixture.html" } } }
    : undefined,
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
