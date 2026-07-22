import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// GitHub Pages project site is served under /<repo>/.
// Override with VITE_BASE (e.g. "/" for a custom domain or user page).
const base = process.env.VITE_BASE ?? "/budget/";

export default defineConfig({
  base,
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
});
