import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke tests run against the FIXTURE harness (fixture.html), not the real app:
 * the app sits behind a shared-account Firebase gate, and CI deliberately holds
 * no Firebase secrets. The harness renders the same screens on a static dataset.
 *
 * They run on the real built bundle (build + preview) rather than the dev
 * server, so a break introduced by the production build is caught too. The fake
 * VITE_FIREBASE_* values only give `initializeApp` a well-formed config —
 * nothing ever connects, since the harness never subscribes.
 */
const PORT = 4173;
const BASE = `http://localhost:${PORT}/budget/`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE,
    trace: "on-first-retry",
  },
  // Phone-sized: the app is a mobile-first PWA.
  projects: [{ name: "mobile", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `${BASE}fixture.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      VITE_E2E: "1",
      VITE_FIREBASE_API_KEY: "e2e-fake-key",
      VITE_FIREBASE_PROJECT_ID: "e2e-fake-project",
      VITE_FIREBASE_ACCOUNT_EMAIL: "e2e@example.invalid",
    },
  },
});
