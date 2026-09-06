import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5173",
    channel: process.env.CI ? undefined : "chrome",
    headless: true,
    viewport: { width: 1280, height: 800 },
  },
  webServer: [
    {
      command: "npm --workspace @ruralcare/api run dev",
      url: "http://127.0.0.1:8787/api/health",
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: "npm --workspace @ruralcare/web run dev -- --host 127.0.0.1",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
