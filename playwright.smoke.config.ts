import { defineConfig, devices } from "@playwright/test";

// Production smoke (docs/superpowers/specs/2026-11-28-smoke-produccion-design.md). Kept apart
// from playwright.config.ts on purpose: that one boots a dev server over the demo catalog and a
// local Supabase; this one only reads the real, deployed site.
const baseURL = process.env.SMOKE_BASE_URL ?? "https://closets-monterrey-nl.vercel.app";

export default defineConfig({
  testDir: "./smoke",
  fullyParallel: true,
  workers: 2,
  // One retry absorbs a cold start or a network blip on the live site; a real break fails twice.
  retries: 1,
  forbidOnly: !!process.env.CI,
  outputDir: "test-results-smoke",
  reporter: [["list"], ["html", { outputFolder: "playwright-report-smoke", open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
